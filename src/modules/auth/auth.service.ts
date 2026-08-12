import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

import { buildOffsetPage, type OffsetPage } from '@/common/pagination';
import type { AppConfiguration } from '@/config/configuration.types';
import { AppException } from '@/core/errors/app.exception';
import { UsersService, type UserWithRoles } from '@/modules/users';
import { MailService } from '@/modules/mail';

import { AuthCryptoService } from './auth-crypto.service';
import { AuthRepository } from './auth.repository';
import type { MessageResponseDto } from './dto/message-response.dto';
import type { SessionResponseDto } from './dto/session-response.dto';
import type { TokenPairResponseDto } from './dto/token-pair-response.dto';

interface ActionDelivery {
  userId: string;
  email: string;
  token: string;
}

@Injectable()
export class AuthService {
  private readonly accessTtl: number;
  private readonly sessionTtl: number;
  private readonly verificationTtl: number;
  private readonly resetTtl: number;
  private readonly maxSessions: number;
  private readonly maxAttempts: number;
  private readonly lockSeconds: number;

  public constructor(
    private readonly repository: AuthRepository,
    private readonly crypto: AuthCryptoService,
    private readonly users: UsersService,
    private readonly mail: MailService,
    config: ConfigService<AppConfiguration, true>,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {
    this.accessTtl = config.getOrThrow('auth.accessTokenTtlSeconds', { infer: true });
    this.sessionTtl = config.getOrThrow('auth.sessionTtlSeconds', { infer: true });
    this.verificationTtl = config.getOrThrow('auth.verificationTokenTtlSeconds', { infer: true });
    this.resetTtl = config.getOrThrow('auth.passwordResetTokenTtlSeconds', { infer: true });
    this.maxSessions = config.getOrThrow('auth.maxActiveSessions', { infer: true });
    this.maxAttempts = config.getOrThrow('auth.maxFailedLoginAttempts', { infer: true });
    this.lockSeconds = config.getOrThrow('auth.loginLockSeconds', { infer: true });
  }

  public async register(
    fullName: string,
    email: string,
    password: string,
  ): Promise<ActionDelivery> {
    const normalizedEmail = this.normalizeEmail(email);
    const passwordHash = await this.crypto.hashPassword(password);
    const user = await this.users.createPendingUser({
      fullName: fullName.trim(),
      email: normalizedEmail,
      normalizedEmail,
      passwordHash,
    });
    const delivery = await this.issueAction(user, 'email_verification', this.verificationTtl);
    await this.mail.sendEmailVerification({
      email: delivery.email,
      fullName: user.fullName,
      token: delivery.token,
      expiresInSeconds: this.verificationTtl,
    });
    return delivery;
  }

  public async resendVerification(email: string): Promise<ActionDelivery | null> {
    const user = await this.users.findForAuthentication(this.normalizeEmail(email));
    if (!user || user.emailVerifiedAt || user.status === 'suspended') return null;
    const delivery = await this.issueAction(user, 'email_verification', this.verificationTtl);
    await this.mail.sendEmailVerification({
      email: delivery.email,
      fullName: user.fullName,
      token: delivery.token,
      expiresInSeconds: this.verificationTtl,
    });
    return delivery;
  }

  public async verifyEmail(rawToken: string): Promise<MessageResponseDto> {
    const hash = this.crypto.hashToken(rawToken);
    const outcome = await this.dataSource.transaction(async (manager) => {
      const token = await this.repository.findActionTokenForUpdate(
        manager,
        hash,
        'email_verification',
      );
      if (!token || token.consumedAt || token.expiresAt <= new Date()) return false;
      await this.users.verifyEmail(token.userId);
      await this.repository.consumeActionToken(manager, token);
      return true;
    });
    if (!outcome) throw new AppException('INVALID_OR_EXPIRED_TOKEN');
    return { message: 'Email address verified' };
  }

  public async login(email: string, password: string): Promise<TokenPairResponseDto> {
    const user = await this.users.findForAuthentication(this.normalizeEmail(email));
    if (!user) {
      await this.crypto.verifyDummyPassword(password);
      throw new AppException('INVALID_CREDENTIALS');
    }
    if (user.lockedUntil && user.lockedUntil > new Date()) throw new AppException('ACCOUNT_LOCKED');
    if (!(await this.crypto.verifyPassword(user.passwordHash, password))) {
      await this.users.recordFailedLogin(user.id, this.maxAttempts, this.lockSeconds);
      throw new AppException('INVALID_CREDENTIALS');
    }
    if (!user.emailVerifiedAt || user.status === 'pending_verification') {
      throw new AppException('EMAIL_NOT_VERIFIED');
    }
    if (user.status === 'suspended') throw new AppException('ACCOUNT_SUSPENDED');
    const current = await this.users.recordSuccessfulLogin(user.id);
    return this.createSession(current);
  }

  public async refresh(rawToken: string): Promise<TokenPairResponseDto> {
    const next = this.crypto.opaqueToken();
    const result = await this.dataSource.transaction(async (manager) => {
      const token = await this.repository.findRefreshForUpdate(
        manager,
        this.crypto.hashToken(rawToken),
      );
      if (!token) return { kind: 'invalid' } as const;
      const session = await this.repository.findSessionForUpdate(manager, token.sessionId);
      if (!session) return { kind: 'invalid' } as const;
      if (token.status !== 'active') {
        await this.repository.revokeSession(manager, session, 'refresh_reuse');
        return { kind: 'reuse' } as const;
      }
      const now = new Date();
      if (token.expiresAt <= now || session.expiresAt <= now || session.revokedAt) {
        await this.repository.revokeSession(manager, session, 'user_requested');
        return { kind: 'invalid' } as const;
      }
      const user = await this.users.findByIdForAuthentication(session.userId);
      if (user?.status !== 'active' || user.authVersion !== session.authVersion) {
        await this.repository.revokeSession(manager, session, 'user_requested');
        return { kind: 'invalid' } as const;
      }
      session.lastUsedAt = now;
      await this.repository.saveSession(manager, session);
      await this.repository.rotateRefresh(manager, token, next.hash, session.expiresAt);
      return { kind: 'success', session, user } as const;
    });
    if (result.kind === 'reuse') throw new AppException('REFRESH_TOKEN_REUSED');
    if (result.kind === 'invalid') throw new AppException('INVALID_REFRESH_TOKEN');
    return this.tokenPair(result.user, result.session.id, next.raw);
  }

  public async forgotPassword(email: string): Promise<ActionDelivery | null> {
    const user = await this.users.findForAuthentication(this.normalizeEmail(email));
    if (user?.status !== 'active') return null;
    const delivery = await this.issueAction(user, 'password_reset', this.resetTtl);
    await this.mail.sendPasswordReset({
      email: delivery.email,
      fullName: user.fullName,
      token: delivery.token,
      expiresInSeconds: this.resetTtl,
    });
    return delivery;
  }

  public async resetPassword(rawToken: string, newPassword: string): Promise<MessageResponseDto> {
    const tokenHash = this.crypto.hashToken(rawToken);
    const passwordHash = await this.crypto.hashPassword(newPassword);
    const userId = await this.dataSource.transaction(async (manager) => {
      const token = await this.repository.findActionTokenForUpdate(
        manager,
        tokenHash,
        'password_reset',
      );
      if (!token || token.consumedAt || token.expiresAt <= new Date()) return null;
      await this.repository.consumeActionToken(manager, token);
      return token.userId;
    });
    if (!userId) throw new AppException('INVALID_OR_EXPIRED_TOKEN');
    await this.users.changePassword(userId, passwordHash, 'auth.password.reset');
    await this.dataSource.transaction((manager) =>
      this.repository.revokeAllForUser(manager, userId, 'password_reset'),
    );
    return { message: 'Password reset completed' };
  }

  public async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<MessageResponseDto> {
    const user = await this.users.findByIdForAuthentication(userId);
    if (!user || !(await this.crypto.verifyPassword(user.passwordHash, currentPassword))) {
      throw new AppException('INVALID_CREDENTIALS');
    }
    const passwordHash = await this.crypto.hashPassword(newPassword);
    await this.users.changePassword(userId, passwordHash, 'auth.password.changed');
    await this.dataSource.transaction((manager) =>
      this.repository.revokeAllForUser(manager, userId, 'password_changed'),
    );
    return { message: 'Password changed; all sessions were revoked' };
  }

  public async logout(sessionId: string | undefined, userId: string): Promise<void> {
    if (!sessionId) throw new AppException('UNAUTHORIZED');
    await this.revokeOwnedSession(userId, sessionId, 'logout');
  }

  public async listSessions(
    userId: string,
    page: number,
    limit: number,
  ): Promise<OffsetPage<SessionResponseDto>> {
    const [sessions, total] = await this.repository.findPage(userId, page, limit);
    return buildOffsetPage(
      sessions.map((session) => ({
        id: session.id,
        createdAt: session.createdAt.toISOString(),
        lastUsedAt: session.lastUsedAt.toISOString(),
        expiresAt: session.expiresAt.toISOString(),
        revokedAt: session.revokedAt?.toISOString() ?? null,
      })),
      total,
      page,
      limit,
    );
  }

  public async revokeOwnedSession(
    userId: string,
    sessionId: string,
    reason: 'logout' | 'user_requested' = 'user_requested',
  ): Promise<void> {
    const found = await this.dataSource.transaction(async (manager) => {
      const session = await this.repository.findSessionForUpdate(manager, sessionId);
      if (session?.userId !== userId) return false;
      await this.repository.revokeSession(manager, session, reason);
      return true;
    });
    if (!found) throw new AppException('SESSION_NOT_FOUND');
  }

  public async revokeAllSessions(userId: string): Promise<void> {
    await this.dataSource.transaction((manager) =>
      this.repository.revokeAllForUser(manager, userId, 'user_requested'),
    );
  }

  private async createSession(user: UserWithRoles): Promise<TokenPairResponseDto> {
    const refresh = this.crypto.opaqueToken();
    const expiresAt = new Date(Date.now() + this.sessionTtl * 1000);
    const session = await this.dataSource.transaction(async (manager) => {
      await this.repository.lockUserSessions(manager, user.id);
      await this.repository.enforceSessionLimit(manager, user.id, this.maxSessions);
      return this.repository.createSession(
        manager,
        user.id,
        user.authVersion,
        expiresAt,
        refresh.hash,
      );
    });
    return this.tokenPair(user, session.id, refresh.raw);
  }

  private async tokenPair(
    user: UserWithRoles,
    sessionId: string,
    refreshToken: string,
  ): Promise<TokenPairResponseDto> {
    const accessToken = await this.crypto.signAccessToken({
      userId: user.id,
      sessionId,
      authVersion: user.authVersion,
    });
    return { accessToken, refreshToken, tokenType: 'Bearer', expiresIn: this.accessTtl };
  }

  private async issueAction(
    user: UserWithRoles,
    purpose: 'email_verification' | 'password_reset',
    ttl: number,
  ): Promise<ActionDelivery> {
    const token = this.crypto.opaqueToken();
    await this.dataSource.transaction((manager) =>
      this.repository.issueActionToken(
        manager,
        user.id,
        purpose,
        token.hash,
        new Date(Date.now() + ttl * 1000),
      ),
    );
    return { userId: user.id, email: user.email, token: token.raw };
  }

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }
}
