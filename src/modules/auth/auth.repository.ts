import { Injectable, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { InjectDataSource } from '@nestjs/typeorm';
import {
  DataSource,
  EntityManager,
  IsNull,
  MoreThan,
  Not,
  type FindOptionsWhere,
  type Repository,
} from 'typeorm';

import type { AuthTokenPurpose, SessionRevokeReason, TwoStepPurpose } from './auth.constants';
import { AuthRecoveryCodeEntity } from './entities/auth-recovery-code.entity';
import { AuthActionTokenEntity } from './entities/auth-action-token.entity';
import { AuthEmailVerificationCodeEntity } from './entities/auth-email-verification-code.entity';
import { AuthRefreshTokenEntity } from './entities/auth-refresh-token.entity';
import { AuthSessionEntity } from './entities/auth-session.entity';
import { AuthTwoStepChallengeEntity } from './entities/auth-two-step-challenge.entity';
import type { SessionMetadata } from './auth.types';

@Injectable()
export class AuthRepository {
  public constructor(
    @InjectRepository(AuthSessionEntity)
    private readonly sessions: Repository<AuthSessionEntity>,
    @Optional() @InjectDataSource() private readonly dataSource?: DataSource,
  ) {}

  public async cleanupOperationalData(
    tokenBefore: Date,
    sessionBefore: Date,
    limit: number,
  ): Promise<number> {
    if (!this.dataSource) throw new Error('Database datasource is required for retention cleanup');
    return this.dataSource.transaction(async (manager) => {
      let deleted = 0;
      const tokenStatements = [
        `DELETE FROM auth_action_tokens WHERE id IN (SELECT id FROM auth_action_tokens WHERE expires_at < $1 OR consumed_at < $1 ORDER BY id LIMIT $2)`,
        `DELETE FROM auth_email_verification_codes WHERE id IN (SELECT id FROM auth_email_verification_codes WHERE expires_at < $1 OR consumed_at < $1 ORDER BY id LIMIT $2)`,
        `DELETE FROM auth_two_step_challenges WHERE id IN (SELECT id FROM auth_two_step_challenges WHERE expires_at < $1 OR consumed_at < $1 ORDER BY id LIMIT $2)`,
        `DELETE FROM auth_recovery_codes WHERE id IN (SELECT id FROM auth_recovery_codes WHERE consumed_at < $1 ORDER BY id LIMIT $2)`,
        `DELETE FROM auth_refresh_tokens WHERE id IN (SELECT id FROM auth_refresh_tokens WHERE expires_at < $1 OR (status <> 'active' AND updated_at < $1) ORDER BY id LIMIT $2)`,
      ];
      for (const statement of tokenStatements) {
        const result: unknown = await manager.query(statement, [tokenBefore, limit]);
        deleted += rowCount(result);
      }
      const sessionResult: unknown = await manager.query(
        `DELETE FROM auth_sessions WHERE id IN (SELECT id FROM auth_sessions WHERE expires_at < $1 OR revoked_at < $1 ORDER BY id LIMIT $2)`,
        [sessionBefore, limit],
      );
      deleted += rowCount(sessionResult);
      return deleted;
    });
  }

  public async lockUserSessions(manager: EntityManager, userId: string): Promise<void> {
    await manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`auth:sessions:${userId}`]);
  }

  public async createSession(
    manager: EntityManager,
    userId: string,
    authVersion: number,
    expiresAt: Date,
    tokenHash: string,
    metadata: SessionMetadata = {
      ipAddress: null,
      userAgent: null,
      device: null,
      location: null,
    },
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
        ipAddress: metadata.ipAddress,
        userAgent: metadata.userAgent,
        deviceMetadata: metadata.device,
        approximateLocation: metadata.location,
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
    revoked?: boolean,
  ): Promise<[AuthSessionEntity[], number]> {
    const where: FindOptionsWhere<AuthSessionEntity> = { userId };
    if (revoked !== undefined) where.revokedAt = revoked ? Not(IsNull()) : IsNull();
    return this.sessions.findAndCount({
      where,
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

  public async issueEmailVerificationCode(
    manager: EntityManager,
    userId: string,
    codeHash: string,
    expiresAt: Date,
  ): Promise<void> {
    await manager
      .getRepository(AuthEmailVerificationCodeEntity)
      .createQueryBuilder()
      .update()
      .set({ consumedAt: new Date() })
      .where('user_id = :userId AND consumed_at IS NULL', { userId })
      .execute();
    const repository = manager.getRepository(AuthEmailVerificationCodeEntity);
    await repository.save(
      repository.create({ userId, codeHash, attempts: 0, expiresAt, consumedAt: null }),
    );
  }

  public findEmailVerificationCodeForUpdate(
    manager: EntityManager,
    userId: string,
  ): Promise<AuthEmailVerificationCodeEntity | null> {
    return manager.getRepository(AuthEmailVerificationCodeEntity).findOne({
      where: { userId, consumedAt: IsNull() },
      order: { createdAt: 'DESC' },
      lock: { mode: 'pessimistic_write' },
    });
  }

  public async saveEmailVerificationCode(
    manager: EntityManager,
    verification: AuthEmailVerificationCodeEntity,
  ): Promise<void> {
    await manager.getRepository(AuthEmailVerificationCodeEntity).save(verification);
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

function rowCount(value: unknown): number {
  return typeof value === 'object' &&
    value !== null &&
    'rowCount' in value &&
    typeof value.rowCount === 'number'
    ? value.rowCount
    : 0;
}
