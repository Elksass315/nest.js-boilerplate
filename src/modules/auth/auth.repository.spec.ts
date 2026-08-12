import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import type { EntityManager } from 'typeorm';

import { AuthRepository } from './auth.repository';
import { AuthActionTokenEntity } from './entities/auth-action-token.entity';
import { AuthRefreshTokenEntity } from './entities/auth-refresh-token.entity';
import { AuthSessionEntity } from './entities/auth-session.entity';

describe(AuthRepository.name, () => {
  const session = Object.assign(new AuthSessionEntity(), {
    id: 'b8f10c56-5e3c-42ee-8436-7994b9691ced',
    userId: '7b3f8ed4-73ef-4afe-8703-b10dd32f3820',
    authVersion: 1,
    lastUsedAt: new Date(),
    expiresAt: new Date('2099-01-01T00:00:00.000Z'),
    revokedAt: null,
    revokeReason: null,
  });
  const sessions = {
    findOneBy: jest.fn().mockResolvedValue(session),
    findAndCount: jest.fn().mockResolvedValue([[session], 1]),
  };
  const sessionStore = {
    create: jest.fn((value: object) =>
      Object.assign(new AuthSessionEntity(), value, { id: session.id }),
    ),
    save: jest.fn((value: AuthSessionEntity) => Promise.resolve(value)),
    findOne: jest.fn().mockResolvedValue(session),
    find: jest.fn().mockResolvedValue([session]),
    findBy: jest.fn().mockResolvedValue([session]),
  };
  const refreshStore = {
    create: jest.fn((value: object) => Object.assign(new AuthRefreshTokenEntity(), value)),
    save: jest.fn((value: AuthRefreshTokenEntity) => Promise.resolve(value)),
    findOne: jest.fn(),
    update: jest.fn().mockResolvedValue(undefined),
  };
  const actionQuery = {
    update: jest.fn().mockReturnThis(),
    set: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    execute: jest.fn().mockResolvedValue(undefined),
  };
  const actionStore = {
    create: jest.fn((value: object) => Object.assign(new AuthActionTokenEntity(), value)),
    save: jest.fn((value: AuthActionTokenEntity) => Promise.resolve(value)),
    findOne: jest.fn(),
    createQueryBuilder: jest.fn(() => actionQuery),
  };
  const manager = {
    getRepository: jest.fn((entity: unknown) => {
      if (entity === AuthSessionEntity) return sessionStore;
      if (entity === AuthRefreshTokenEntity) return refreshStore;
      return actionStore;
    }),
    query: jest.fn().mockResolvedValue([]),
  } as unknown as EntityManager;
  let repository: AuthRepository;

  beforeEach(async () => {
    session.revokedAt = null;
    session.revokeReason = null;
    const module = await Test.createTestingModule({
      providers: [
        AuthRepository,
        { provide: getRepositoryToken(AuthSessionEntity), useValue: sessions },
      ],
    }).compile();
    repository = module.get(AuthRepository);
  });

  afterEach(() => jest.clearAllMocks());

  it('creates a session and its first hashed refresh token', async () => {
    await repository.lockUserSessions(manager, session.userId);
    await repository.createSession(manager, session.userId, 1, session.expiresAt, 'h'.repeat(64));
    expect(sessionStore.save).toHaveBeenCalled();
    expect(manager.query).toHaveBeenCalledWith('SELECT pg_advisory_xact_lock(hashtext($1))', [
      `auth:sessions:${session.userId}`,
    ]);
    expect(refreshStore.save).toHaveBeenCalledWith(
      expect.objectContaining({ tokenHash: 'h'.repeat(64), status: 'active' }),
    );
  });

  it('locks tokens and sessions and reads live or paginated sessions', async () => {
    refreshStore.findOne.mockResolvedValue({ tokenHash: 'h'.repeat(64) });
    actionStore.findOne.mockResolvedValue({ tokenHash: 'a'.repeat(64) });
    await repository.findRefreshForUpdate(manager, 'h'.repeat(64));
    await repository.findSessionForUpdate(manager, session.id);
    await repository.findActionTokenForUpdate(manager, 'a'.repeat(64), 'password_reset');
    await repository.findActiveSession(session.id);
    await repository.findPage(session.userId, 2, 10);
    expect(sessions.findAndCount).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 10, take: 10 }),
    );
  });

  it('rotates and revokes refresh-token state', async () => {
    const refresh = Object.assign(new AuthRefreshTokenEntity(), {
      sessionId: session.id,
      status: 'active' as const,
    });
    await repository.rotateRefresh(manager, refresh, 'n'.repeat(64), session.expiresAt);
    expect(refresh.status).toBe('rotated');

    await repository.revokeSession(manager, session, 'logout');
    expect(session.revokeReason).toBe('logout');
    expect(refreshStore.update).toHaveBeenCalled();
  });

  it('revokes all except an explicitly retained session and enforces LRU limits', async () => {
    const retained = Object.assign(new AuthSessionEntity(), session, { id: 'retained' });
    const oldest = Object.assign(new AuthSessionEntity(), session, { id: 'oldest' });
    sessionStore.findBy.mockResolvedValue([retained, oldest]);
    sessionStore.find.mockResolvedValue([oldest, retained]);

    await repository.revokeAllForUser(manager, session.userId, 'password_changed', 'retained');
    await repository.enforceSessionLimit(manager, session.userId, 2);

    expect(sessionStore.save).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'oldest', revokedAt: expect.any(Date) }),
    );
  });

  it('invalidates prior action tokens and consumes the replacement', async () => {
    await repository.issueActionToken(
      manager,
      session.userId,
      'email_verification',
      'a'.repeat(64),
      session.expiresAt,
    );
    expect(actionQuery.execute).toHaveBeenCalled();

    const action = Object.assign(new AuthActionTokenEntity(), { consumedAt: null });
    await repository.consumeActionToken(manager, action);
    expect(action.consumedAt).toBeInstanceOf(Date);
    expect(actionStore.save).toHaveBeenCalledWith(action);
  });

  it('does not mutate an already revoked session', async () => {
    const revoked = Object.assign(new AuthSessionEntity(), session, { revokedAt: new Date() });
    await repository.revokeSession(manager, revoked, 'logout');
    expect(sessionStore.save).not.toHaveBeenCalled();
  });
});
