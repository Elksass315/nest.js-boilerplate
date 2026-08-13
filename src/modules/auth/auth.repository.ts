import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, IsNull, MoreThan, type Repository } from 'typeorm';

import type { AuthTokenPurpose, SessionRevokeReason, TwoStepPurpose } from './auth.constants';
import { AuthRecoveryCodeEntity } from './entities/auth-recovery-code.entity';
import { AuthActionTokenEntity } from './entities/auth-action-token.entity';
import { AuthRefreshTokenEntity } from './entities/auth-refresh-token.entity';
import { AuthSessionEntity } from './entities/auth-session.entity';
import { AuthTwoStepChallengeEntity } from './entities/auth-two-step-challenge.entity';

@Injectable()
export class AuthRepository {
  public constructor(
    @InjectRepository(AuthSessionEntity)
    private readonly sessions: Repository<AuthSessionEntity>,
  ) {}

  public async lockUserSessions(manager: EntityManager, userId: string): Promise<void> {
    await manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`auth:sessions:${userId}`]);
  }

  public async createSession(
    manager: EntityManager,
    userId: string,
    authVersion: number,
    expiresAt: Date,
    tokenHash: string,
  ): Promise<AuthSessionEntity> {
    const now = new Date();
    const session = await manager.getRepository(AuthSessionEntity).save(
      manager.getRepository(AuthSessionEntity).create({
        userId,
        authVersion,
        lastUsedAt: now,
        expiresAt,
        revokedAt: null,
        revokeReason: null,
      }),
    );
    await manager.getRepository(AuthRefreshTokenEntity).save(
      manager.getRepository(AuthRefreshTokenEntity).create({
        sessionId: session.id,
        tokenHash,
        status: 'active',
        expiresAt,
      }),
    );
    return session;
  }

  public findRefreshForUpdate(
    manager: EntityManager,
    tokenHash: string,
  ): Promise<AuthRefreshTokenEntity | null> {
    return manager.getRepository(AuthRefreshTokenEntity).findOne({
      where: { tokenHash },
      lock: { mode: 'pessimistic_write' },
    });
  }

  public findSessionForUpdate(
    manager: EntityManager,
    id: string,
  ): Promise<AuthSessionEntity | null> {
    return manager.getRepository(AuthSessionEntity).findOne({
      where: { id },
      lock: { mode: 'pessimistic_write' },
    });
  }

  public findActiveSession(id: string): Promise<AuthSessionEntity | null> {
    return this.sessions.findOneBy({ id, revokedAt: IsNull(), expiresAt: MoreThan(new Date()) });
  }

  public saveSession(
    manager: EntityManager,
    session: AuthSessionEntity,
  ): Promise<AuthSessionEntity> {
    return manager.getRepository(AuthSessionEntity).save(session);
  }

  public async rotateRefresh(
    manager: EntityManager,
    current: AuthRefreshTokenEntity,
    nextHash: string,
    expiresAt: Date,
  ): Promise<void> {
    current.status = 'rotated';
    await manager.getRepository(AuthRefreshTokenEntity).save(current);
    await manager.getRepository(AuthRefreshTokenEntity).save(
      manager.getRepository(AuthRefreshTokenEntity).create({
        sessionId: current.sessionId,
        tokenHash: nextHash,
        status: 'active',
        expiresAt,
      }),
    );
  }

  public async revokeSession(
    manager: EntityManager,
    session: AuthSessionEntity,
    reason: SessionRevokeReason,
  ): Promise<void> {
    if (session.revokedAt) return;
    session.revokedAt = new Date();
    session.revokeReason = reason;
    await manager.getRepository(AuthSessionEntity).save(session);
    await manager
      .getRepository(AuthRefreshTokenEntity)
      .update({ sessionId: session.id, status: 'active' }, { status: 'revoked' });
  }

  public async revokeAllForUser(
    manager: EntityManager,
    userId: string,
    reason: SessionRevokeReason,
    exceptSessionId?: string,
  ): Promise<void> {
    const active = await manager.getRepository(AuthSessionEntity).findBy({
      userId,
      revokedAt: IsNull(),
    });
    for (const session of active) {
      if (session.id !== exceptSessionId) await this.revokeSession(manager, session, reason);
    }
  }

  public async enforceSessionLimit(
    manager: EntityManager,
    userId: string,
    maximum: number,
  ): Promise<void> {
    const active = await manager.getRepository(AuthSessionEntity).find({
      where: { userId, revokedAt: IsNull(), expiresAt: MoreThan(new Date()) },
      order: { lastUsedAt: 'ASC', id: 'ASC' },
    });
    for (const session of active.slice(0, Math.max(0, active.length - maximum + 1))) {
      await this.revokeSession(manager, session, 'session_limit');
    }
  }

  public findPage(
    userId: string,
    page: number,
    limit: number,
  ): Promise<[AuthSessionEntity[], number]> {
    return this.sessions.findAndCount({
      where: { userId },
      order: { createdAt: 'DESC', id: 'ASC' },
      skip: (page - 1) * limit,
      take: limit,
    });
  }

  public async issueActionToken(
    manager: EntityManager,
    userId: string,
    purpose: AuthTokenPurpose,
    tokenHash: string,
    expiresAt: Date,
  ): Promise<void> {
    await manager
      .getRepository(AuthActionTokenEntity)
      .createQueryBuilder()
      .update()
      .set({ consumedAt: new Date() })
      .where('user_id = :userId AND purpose = :purpose AND consumed_at IS NULL', {
        userId,
        purpose,
      })
      .execute();
    await manager.getRepository(AuthActionTokenEntity).save(
      manager.getRepository(AuthActionTokenEntity).create({
        userId,
        purpose,
        tokenHash,
        expiresAt,
        consumedAt: null,
      }),
    );
  }

  public findActionTokenForUpdate(
    manager: EntityManager,
    tokenHash: string,
    purpose: AuthTokenPurpose,
  ): Promise<AuthActionTokenEntity | null> {
    return manager.getRepository(AuthActionTokenEntity).findOne({
      where: { tokenHash, purpose },
      lock: { mode: 'pessimistic_write' },
    });
  }

  public async consumeActionToken(
    manager: EntityManager,
    token: AuthActionTokenEntity,
  ): Promise<void> {
    token.consumedAt = new Date();
    await manager.getRepository(AuthActionTokenEntity).save(token);
  }

  public async issueTwoStepChallenge(
    manager: EntityManager,
    userId: string,
    purpose: TwoStepPurpose,
    tokenHash: string,
    codeHash: string,
    expiresAt: Date,
  ): Promise<void> {
    await manager
      .getRepository(AuthTwoStepChallengeEntity)
      .createQueryBuilder()
      .update()
      .set({ consumedAt: new Date() })
      .where('user_id = :userId AND purpose = :purpose AND consumed_at IS NULL', {
        userId,
        purpose,
      })
      .execute();
    await manager.getRepository(AuthTwoStepChallengeEntity).save(
      manager.getRepository(AuthTwoStepChallengeEntity).create({
        userId,
        purpose,
        tokenHash,
        codeHash,
        attempts: 0,
        expiresAt,
        consumedAt: null,
      }),
    );
  }

  public findTwoStepChallengeForUpdate(
    manager: EntityManager,
    tokenHash: string,
  ): Promise<AuthTwoStepChallengeEntity | null> {
    return manager.getRepository(AuthTwoStepChallengeEntity).findOne({
      where: { tokenHash },
      lock: { mode: 'pessimistic_write' },
    });
  }

  public async saveTwoStepChallenge(
    manager: EntityManager,
    challenge: AuthTwoStepChallengeEntity,
  ): Promise<void> {
    await manager.getRepository(AuthTwoStepChallengeEntity).save(challenge);
  }

  public async replaceRecoveryCodes(
    manager: EntityManager,
    userId: string,
    codeHashes: readonly string[],
  ): Promise<void> {
    await manager.getRepository(AuthRecoveryCodeEntity).delete({ userId });
    await manager.getRepository(AuthRecoveryCodeEntity).save(
      codeHashes.map((codeHash) =>
        manager.getRepository(AuthRecoveryCodeEntity).create({
          userId,
          codeHash,
          consumedAt: null,
        }),
      ),
    );
  }

  public findRecoveryCodesForUpdate(
    manager: EntityManager,
    userId: string,
  ): Promise<AuthRecoveryCodeEntity[]> {
    return manager.getRepository(AuthRecoveryCodeEntity).find({
      where: { userId, consumedAt: IsNull() },
      order: { createdAt: 'ASC', id: 'ASC' },
      lock: { mode: 'pessimistic_write' },
    });
  }

  public async consumeRecoveryCode(
    manager: EntityManager,
    recoveryCode: AuthRecoveryCodeEntity,
  ): Promise<void> {
    recoveryCode.consumedAt = new Date();
    await manager.getRepository(AuthRecoveryCodeEntity).save(recoveryCode);
  }

  public async deleteRecoveryCodes(manager: EntityManager, userId: string): Promise<void> {
    await manager.getRepository(AuthRecoveryCodeEntity).delete({ userId });
  }
}
