import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, type EntityManager } from 'typeorm';

import { buildOffsetPage, type OffsetPage } from '@/common/pagination';
import type { AppConfiguration } from '@/config/configuration.types';
import { AppException } from '@/core/errors/app.exception';
import { MailService } from '@/modules/mail';
import { UsersService, type UserWithRoles } from '@/modules/users';

import type { TwoStepPurpose } from './auth.constants';
import { AuthCryptoService } from './auth-crypto.service';
import { AuthRepository } from './auth.repository';
import type { MessageResponseDto } from './dto/message-response.dto';
import type {
  RegistrationResponseDto,
  VerificationResendResponseDto,
} from './dto/email-verification.dto';
import type { LoginResponseDto } from './dto/login-response.dto';
import type { SessionResponseDto } from './dto/session-response.dto';
import type { TokenPairResponseDto } from './dto/token-pair-response.dto';
import type { RecoveryCodesResponseDto, TwoStepChallengeResponseDto } from './dto/two-step.dto';
import type { SessionMetadata } from './auth.types';

interface ActionDelivery {
  userId: string;
  email: string;
  token: string;
}

type LoginResult = LoginResponseDto | TwoStepChallengeResponseDto;
type LoginTwoStepCredential =
  { method: 'email_code'; code: string } | { method: 'recovery_code'; recoveryCode: string };
type TwoStepProofResult =
  | { kind: 'invalid_challenge' }
  | { kind: 'attempts_exceeded' }
  | { kind: 'invalid_code' }
  | { kind: 'invalid_recovery' }
  | { kind: 'success'; userId: string };
type VerificationProofResult =
  { kind: 'invalid' } | { kind: 'attempts_exceeded' } | { kind: 'success' };

@Injectable()
export class AuthService {
  private readonly accessTtl: number;
  private readonly sessionTtl: number;
  private readonly verificationTtl: number;
  private readonly verificationMaxAttempts: number;
  private readonly resetTtl: number;
  private readonly maxSessions: number;
  private readonly maxAttempts: number;
  private readonly lockSeconds: number;
  private readonly twoStepTtl: number;
  private readonly twoStepMaxAttempts: number;
  private readonly recoveryCodeCount: number;

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
    this.verificationTtl = config.getOrThrow('auth.verificationCodeTtlSeconds', { infer: true });
    this.verificationMaxAttempts = config.getOrThrow('auth.verificationCodeMaxAttempts', {
      infer: true,
    });
    this.resetTtl = config.getOrThrow('auth.passwordResetTokenTtlSeconds', { infer: true });
    this.maxSessions = config.getOrThrow('auth.maxActiveSessions', { infer: true });
    this.maxAttempts = config.getOrThrow('auth.maxFailedLoginAttempts', { infer: true });
    this.lockSeconds = config.getOrThrow('auth.loginLockSeconds', { infer: true });
    this.twoStepTtl = config.getOrThrow('auth.twoStepCodeTtlSeconds', { infer: true });
    this.twoStepMaxAttempts = config.getOrThrow('auth.twoStepMaxAttempts', { infer: true });
    this.recoveryCodeCount = config.getOrThrow('auth.recoveryCodeCount', { infer: true });
  }

  public cleanupOperationalData(
    tokenBefore: Date,
    sessionBefore: Date,
    limit: number,
  ): Promise<number> {
    return this.repository.cleanupOperationalData(tokenBefore, sessionBefore, limit);
  }

  public async register(
    fullName: string,
    email: string,
    password: string,
  ): Promise<RegistrationResponseDto> {
    const normalizedEmail = this.normalizeEmail(email);
    const passwordHash = await this.crypto.hashPassword(password);
    let registrationId = '';
    await this.dataSource.transaction(async (manager) => {
      const user = await this.users.createOrUpdatePendingUser(
        {
          fullName: fullName.trim(),
          email: normalizedEmail,
          normalizedEmail,
          passwordHash,
        },
        manager,
      );
      registrationId = user.id;
      const code = await this.issueEmailVerificationCode(user.id, manager);
      await this.mail.sendEmailVerification(
        {
          email: user.email,
          fullName: user.fullName,
          code,
          expiresInSeconds: this.verificationTtl,
        },
        manager,
      );
    });
    return {
      registrationId,
      verificationExpiresIn: this.verificationTtl,
      message: 'Registration accepted; enter the code sent to your email',
    };
  }

  public hashAccountPassword(password: string): Promise<string> {
    return this.crypto.hashPassword(password);
  }

  public async resendVerification(registrationId: string): Promise<VerificationResendResponseDto> {
    const user = await this.users.findByIdForAuthentication(registrationId);
    if (user?.status === 'pending_verification' && !user.emailVerifiedAt) {
      await this.dataSource.transaction(async (manager) => {
        const code = await this.issueEmailVerificationCode(user.id, manager);
        await this.mail.sendEmailVerification(
          {
            email: user.email,
            fullName: user.fullName,
            code,
            expiresInSeconds: this.verificationTtl,
          },
          manager,
        );
      });
    }
    return {
      verificationExpiresIn: this.verificationTtl,
      message: 'If the registration is eligible, a verification code will be sent',
    };
  }

  public async verifyEmail(registrationId: string, code: string): Promise<MessageResponseDto> {
    const result: VerificationProofResult = await this.dataSource.transaction(async (manager) => {
      const verification = await this.repository.findEmailVerificationCodeForUpdate(
        manager,
        registrationId,
      );
      if (!verification || verification.expiresAt <= new Date()) {
        return { kind: 'invalid' } as const;
      }
      if (verification.attempts >= this.verificationMaxAttempts) {
        return { kind: 'attempts_exceeded' } as const;
      }
      if (!(await this.crypto.verifySecret(verification.codeHash, code))) {
        verification.attempts += 1;
        if (verification.attempts >= this.verificationMaxAttempts) {
          verification.consumedAt = new Date();
        }
        await this.repository.saveEmailVerificationCode(manager, verification);
        return verification.attempts >= this.verificationMaxAttempts
          ? ({ kind: 'attempts_exceeded' } as const)
          : ({ kind: 'invalid' } as const);
      }
      verification.consumedAt = new Date();
      await this.users.verifyEmail(registrationId, manager);
      await this.repository.saveEmailVerificationCode(manager, verification);
      return { kind: 'success' } as const;
    });
    if (result.kind === 'attempts_exceeded') {
      throw new AppException('VERIFICATION_ATTEMPTS_EXCEEDED');
    }
    if (result.kind === 'invalid') {
      throw new AppException('INVALID_OR_EXPIRED_VERIFICATION_CODE');
    }
    return { message: 'Email address verified' };
  }

  private async issueEmailVerificationCode(
    userId: string,
    transactionManager: EntityManager,
  ): Promise<string> {
    const code = this.crypto.numericCode();
    const codeHash = await this.crypto.hashSecret(code);
    const issue = (manager: EntityManager): Promise<void> =>
      this.repository.issueEmailVerificationCode(
        manager,
        userId,
        codeHash,
        new Date(Date.now() + this.verificationTtl * 1000),
      );
    await issue(transactionManager);
    return code;
  }

  public async login(
    email: string,
    password: string,
    metadata: SessionMetadata = emptySessionMetadata(),
  ): Promise<LoginResult> {
    const user = await this.users.findForAuthentication(this.normalizeEmail(email));
    if (!user) {
      await this.crypto.verifyDummyPassword(password);
      throw new AppException('INVALID_CREDENTIALS');
    }
    const locked = user.lockedUntil !== null && user.lockedUntil > new Date();
    if (!(await this.crypto.verifyPassword(user.passwordHash, password))) {
      if (!locked) await this.users.recordFailedLogin(user.id, this.maxAttempts, this.lockSeconds);
      throw new AppException('INVALID_CREDENTIALS');
    }
    if (locked) throw new AppException('ACCOUNT_LOCKED');
    this.assertLoginAllowed(user);
    const current = await this.users.recordSuccessfulLogin(user.id);
    if (this.requiresEmailTwoStep(current)) return this.issueTwoStepChallenge(current, 'login');
    return this.createSession(current, metadata);
  }

  public async completeLoginTwoStep(
    challengeToken: string,
    credential: LoginTwoStepCredential,
    metadata: SessionMetadata = emptySessionMetadata(),
  ): Promise<LoginResponseDto> {
    const userId = await this.consumeTwoStepProof(challengeToken, 'login', credential);
    const user = await this.users.findByIdForAuthentication(userId);
    if (!user || !this.requiresEmailTwoStep(user)) {
      throw new AppException('INVALID_TWO_STEP_CHALLENGE');
    }
    this.assertLoginAllowed(user);
    return this.createSession(user, metadata);
  }

  public async requestTwoStepChange(
    userId: string,
    currentPassword: string,
    purpose: Exclude<TwoStepPurpose, 'login'>,
  ): Promise<TwoStepChallengeResponseDto> {
    const user = await this.requireCurrentPassword(userId, currentPassword);
    if (purpose === 'enable' && user.emailTwoStepEnabled) {
      throw new AppException('TWO_STEP_ALREADY_ENABLED');
    }
    if (
      purpose !== 'enable' &&
      user.roles.some(({ key }) => key === 'admin' || key === 'super_admin')
    ) {
      throw new AppException('TWO_STEP_REQUIRED_FOR_ADMIN_ROLE');
    }
    if (purpose !== 'enable' && !user.emailTwoStepEnabled) {
      throw new AppException('TWO_STEP_NOT_ENABLED');
    }
    return this.issueTwoStepChallenge(user, purpose);
  }

  public async enableTwoStep(
    userId: string,
    challengeToken: string,
    code: string,
  ): Promise<RecoveryCodesResponseDto> {
    await this.consumeTwoStepProof(
      challengeToken,
      'enable',
      { method: 'email_code', code },
      userId,
    );
    const recoveryCodes = await this.replaceRecoveryCodes(userId);
    let user: UserWithRoles;
    try {
      user = await this.users.setEmailTwoStep(userId, true);
    } catch (error) {
      await this.dataSource.transaction((manager) =>
        this.repository.deleteRecoveryCodes(manager, userId),
      );
      throw error;
    }
    await this.revokeEverySession(userId, 'user_requested');
    await this.mail.sendTwoStepChanged({
      email: user.email,
      fullName: user.fullName,
      enabled: true,
      occurredAt: new Date(),
    });
    return { recoveryCodes };
  }

  public async disableTwoStep(
    userId: string,
    challengeToken: string,
    code: string,
  ): Promise<MessageResponseDto> {
    await this.consumeTwoStepProof(
      challengeToken,
      'disable',
      { method: 'email_code', code },
      userId,
    );
    const user = await this.users.setEmailTwoStep(userId, false);
    await this.dataSource.transaction((manager) =>
      this.repository.deleteRecoveryCodes(manager, userId),
    );
    await this.revokeEverySession(userId, 'user_requested');
    await this.mail.sendTwoStepChanged({
      email: user.email,
      fullName: user.fullName,
      enabled: false,
      occurredAt: new Date(),
    });
    return { message: 'Email two-step verification disabled; all sessions were revoked' };
  }

  public async regenerateRecoveryCodes(
    userId: string,
    challengeToken: string,
    code: string,
  ): Promise<RecoveryCodesResponseDto> {
    await this.consumeTwoStepProof(
      challengeToken,
      'recovery_regenerate',
      { method: 'email_code', code },
      userId,
    );
    const recoveryCodes = await this.replaceRecoveryCodes(userId);
    await this.users.auditRecoveryCodesRegenerated(userId);
    return { recoveryCodes };
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
        return { kind: 'reuse', userId: session.userId } as const;
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
    if (result.kind === 'reuse') {
      const user = await this.users.findByIdForAuthentication(result.userId);
      if (user) {
        await this.mail.sendForcedSessionRevocation({
          email: user.email,
          fullName: user.fullName,
          occurredAt: new Date(),
        });
      }
      throw new AppException('REFRESH_TOKEN_REUSED');
    }
    if (result.kind === 'invalid') throw new AppException('INVALID_REFRESH_TOKEN');
    return this.tokenPair(result.user, result.session.id, next.raw);
  }

  public async forgotPassword(email: string): Promise<ActionDelivery | null> {
    const user = await this.users.findForAuthentication(this.normalizeEmail(email));
    if (user?.status !== 'active') return null;
    const delivery = await this.dataSource.transaction(async (manager) => {
      const action = await this.issueAction(user, 'password_reset', this.resetTtl, manager);
      await this.mail.sendPasswordReset(
        {
          email: action.email,
          fullName: user.fullName,
          token: action.token,
          expiresInSeconds: this.resetTtl,
        },
        manager,
      );
      return action;
    });
    return delivery;
  }

  public async resetPassword(rawToken: string, newPassword: string): Promise<MessageResponseDto> {
    const passwordHash = await this.crypto.hashPassword(newPassword);
    const userId = await this.dataSource.transaction(async (manager) => {
      const token = await this.repository.findActionTokenForUpdate(
        manager,
        this.crypto.hashToken(rawToken),
        'password_reset',
      );
      if (!token || token.consumedAt || token.expiresAt <= new Date()) return null;
      await this.repository.consumeActionToken(manager, token);
      return token.userId;
    });
    if (!userId) throw new AppException('INVALID_OR_EXPIRED_TOKEN');
    await this.users.changePassword(userId, passwordHash, 'auth.password.reset');
    await this.revokeEverySession(userId, 'password_reset');
    const user = await this.users.findByIdForAuthentication(userId);
    if (user) {
      await this.mail.sendPasswordChanged({
        email: user.email,
        fullName: user.fullName,
        occurredAt: new Date(),
      });
    }
    return { message: 'Password reset completed' };
  }

  public async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<MessageResponseDto> {
    const user = await this.requireCurrentPassword(userId, currentPassword);
    const passwordHash = await this.crypto.hashPassword(newPassword);
    await this.users.changePassword(userId, passwordHash, 'auth.password.changed');
    await this.revokeEverySession(userId, 'password_changed');
    await this.mail.sendPasswordChanged({
      email: user.email,
      fullName: user.fullName,
      occurredAt: new Date(),
    });
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
    revoked?: boolean,
  ): Promise<OffsetPage<SessionResponseDto>> {
    const [sessions, total] = await this.repository.findPage(userId, page, limit, revoked);
    return buildOffsetPage(
      sessions.map((session) => ({
        id: session.id,
        createdAt: session.createdAt.toISOString(),
        lastUsedAt: session.lastUsedAt.toISOString(),
        expiresAt: session.expiresAt.toISOString(),
        revokedAt: session.revokedAt?.toISOString() ?? null,
        ipAddress: session.ipAddress,
        userAgent: session.userAgent,
        device: session.deviceMetadata,
        location: session.approximateLocation,
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

  public revokeAllSessions(userId: string): Promise<void> {
    return this.revokeEverySession(userId, 'user_requested');
  }

  private async createSession(
    user: UserWithRoles,
    metadata: SessionMetadata,
  ): Promise<LoginResponseDto> {
    const refresh = this.crypto.opaqueToken();
    const expiresAt = new Date(Date.now() + this.sessionTtl * 1000);
    const session = await this.dataSource.transaction(async (manager) => {
      await this.repository.lockUserSessions(manager, user.id);
      await this.repository.enforceSessionLimit(manager, user.id, this.maxSessions);
      const created = await this.repository.createSession(
        manager,
        user.id,
        user.authVersion,
        expiresAt,
        refresh.hash,
        metadata,
      );
      await this.mail.sendNewSession(
        { email: user.email, fullName: user.fullName, occurredAt: new Date() },
        manager,
      );
      return created;
    });
    const tokens = await this.tokenPair(user, session.id, refresh.raw);
    const profile = await this.users.getSelf(user.id);
    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      tokenType: tokens.tokenType,
      expiresIn: tokens.expiresIn,
      user: {
        id: profile.id,
        fullName: profile.fullName,
        email: profile.email,
        status: profile.status,
        emailVerifiedAt: profile.emailVerifiedAt,
        emailTwoStepEnabled: profile.emailTwoStepEnabled,
        emailTwoStepRequired: profile.emailTwoStepRequired,
        roles: profile.roles,
        permissions: [...new Set(user.roles.flatMap(({ permissions }) => permissions))],
        avatar: profile.avatar,
        createdAt: profile.createdAt,
        updatedAt: profile.updatedAt,
      },
    };
  }

  private requiresEmailTwoStep(user: UserWithRoles): boolean {
    return (
      user.emailTwoStepEnabled ||
      user.roles.some(({ key }) => key === 'admin' || key === 'super_admin')
    );
  }

  private async issueTwoStepChallenge(
    user: UserWithRoles,
    purpose: TwoStepPurpose,
  ): Promise<TwoStepChallengeResponseDto> {
    const challenge = this.crypto.opaqueToken();
    const code = this.crypto.numericCode();
    const codeHash = await this.crypto.hashSecret(code);
    await this.dataSource.transaction(async (manager) => {
      await this.repository.issueTwoStepChallenge(
        manager,
        user.id,
        purpose,
        challenge.hash,
        codeHash,
        new Date(Date.now() + this.twoStepTtl * 1000),
      );
      await this.mail.sendTwoStepCode(
        {
          email: user.email,
          fullName: user.fullName,
          code,
          expiresInSeconds: this.twoStepTtl,
          purpose,
        },
        manager,
      );
    });
    return { requiresTwoStep: true, challengeToken: challenge.raw, expiresIn: this.twoStepTtl };
  }

  private async consumeTwoStepProof(
    rawChallenge: string,
    purpose: TwoStepPurpose,
    credential: LoginTwoStepCredential,
    expectedUserId?: string,
  ): Promise<string> {
    const result: TwoStepProofResult = await this.dataSource.transaction(async (manager) => {
      const challenge = await this.repository.findTwoStepChallengeForUpdate(
        manager,
        this.crypto.hashToken(rawChallenge),
      );
      if (
        challenge?.purpose !== purpose ||
        challenge.consumedAt ||
        challenge.expiresAt <= new Date() ||
        (expectedUserId !== undefined && challenge.userId !== expectedUserId)
      ) {
        return { kind: 'invalid_challenge' } as const;
      }
      if (challenge.attempts >= this.twoStepMaxAttempts) {
        return { kind: 'attempts_exceeded' } as const;
      }
      const valid =
        credential.method === 'email_code'
          ? await this.crypto.verifySecret(challenge.codeHash, credential.code)
          : await this.consumeRecoveryCode(manager, challenge.userId, credential.recoveryCode);
      if (!valid) {
        challenge.attempts += 1;
        await this.repository.saveTwoStepChallenge(manager, challenge);
        if (challenge.attempts >= this.twoStepMaxAttempts) {
          return { kind: 'attempts_exceeded' } as const;
        }
        return {
          kind: credential.method === 'email_code' ? 'invalid_code' : 'invalid_recovery',
        } as const;
      }
      challenge.consumedAt = new Date();
      await this.repository.saveTwoStepChallenge(manager, challenge);
      return { kind: 'success', userId: challenge.userId } as const;
    });
    if (result.kind === 'invalid_challenge') {
      throw new AppException('INVALID_TWO_STEP_CHALLENGE');
    }
    if (result.kind === 'attempts_exceeded') {
      throw new AppException('TWO_STEP_ATTEMPTS_EXCEEDED');
    }
    if (result.kind === 'invalid_code') throw new AppException('INVALID_TWO_STEP_CODE');
    if (result.kind === 'invalid_recovery') throw new AppException('INVALID_RECOVERY_CODE');
    return result.userId;
  }

  private async consumeRecoveryCode(
    manager: EntityManager,
    userId: string,
    rawCode: string,
  ): Promise<boolean> {
    const codes = await this.repository.findRecoveryCodesForUpdate(manager, userId);
    for (const code of codes) {
      if (await this.crypto.verifySecret(code.codeHash, rawCode.toUpperCase())) {
        await this.repository.consumeRecoveryCode(manager, code);
        return true;
      }
    }
    return false;
  }

  private async replaceRecoveryCodes(userId: string): Promise<string[]> {
    const recoveryCodes = this.crypto.recoveryCodes(this.recoveryCodeCount);
    const hashes = await Promise.all(recoveryCodes.map((code) => this.crypto.hashSecret(code)));
    await this.dataSource.transaction((manager) =>
      this.repository.replaceRecoveryCodes(manager, userId, hashes),
    );
    return recoveryCodes;
  }

  private async requireCurrentPassword(
    userId: string,
    currentPassword: string,
  ): Promise<UserWithRoles> {
    const user = await this.users.findByIdForAuthentication(userId);
    if (!user || !(await this.crypto.verifyPassword(user.passwordHash, currentPassword))) {
      throw new AppException('INVALID_CREDENTIALS');
    }
    return user;
  }

  private assertLoginAllowed(user: UserWithRoles): void {
    if (!user.emailVerifiedAt || user.status === 'pending_verification') {
      throw new AppException('EMAIL_NOT_VERIFIED');
    }
    if (user.status === 'suspended') throw new AppException('ACCOUNT_SUSPENDED');
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
    purpose: 'password_reset',
    ttl: number,
    transactionManager: EntityManager,
  ): Promise<ActionDelivery> {
    const token = this.crypto.opaqueToken();
    const issue = (manager: EntityManager): Promise<void> =>
      this.repository.issueActionToken(
        manager,
        user.id,
        purpose,
        token.hash,
        new Date(Date.now() + ttl * 1000),
      );
    await issue(transactionManager);
    return { userId: user.id, email: user.email, token: token.raw };
  }

  private revokeEverySession(
    userId: string,
    reason: 'password_reset' | 'password_changed' | 'user_requested',
  ): Promise<void> {
    return this.dataSource.transaction((manager) =>
      this.repository.revokeAllForUser(manager, userId, reason),
    );
  }

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }
}

function emptySessionMetadata(): SessionMetadata {
  return { ipAddress: null, userAgent: null, device: null, location: null };
}
