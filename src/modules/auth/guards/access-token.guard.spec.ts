import type { ExecutionContext } from '@nestjs/common';
import { Test } from '@nestjs/testing';

import { AppException } from '@/core/errors/app.exception';
import { UsersService } from '@/modules/users';

import { AuthCryptoService } from '../auth-crypto.service';
import { AuthRepository } from '../auth.repository';
import { AccessTokenGuard } from './access-token.guard';

describe(AccessTokenGuard.name, () => {
  const crypto = { verifyAccessToken: jest.fn() };
  const repository = { findActiveSession: jest.fn() };
  const users = { findByIdForAuthentication: jest.fn() };
  const request: { headers: { authorization?: string }; user?: unknown } = { headers: {} };
  const context = {
    switchToHttp: (): { getRequest: () => typeof request } => ({ getRequest: () => request }),
  } as ExecutionContext;
  let guard: AccessTokenGuard;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      providers: [
        AccessTokenGuard,
        { provide: AuthCryptoService, useValue: crypto },
        { provide: AuthRepository, useValue: repository },
        { provide: UsersService, useValue: users },
      ],
    }).compile();
    guard = module.get(AccessTokenGuard);
  });

  afterEach(() => {
    jest.clearAllMocks();
    request.headers = {};
    delete request.user;
  });

  it('allows public requests without an authorization header', async () => {
    await expect(guard.canActivate(context)).resolves.toBe(true);
  });

  it('rejects malformed or invalid bearer tokens', async () => {
    request.headers.authorization = 'Basic invalid';
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(AppException);

    request.headers.authorization = 'Bearer invalid';
    crypto.verifyAccessToken.mockResolvedValue(null);
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(AppException);
  });

  it('hydrates a current principal from live session and user state', async () => {
    request.headers.authorization = 'Bearer valid.token.value';
    crypto.verifyAccessToken.mockResolvedValue({
      userId: 'user-1',
      sessionId: 'session-1',
      authVersion: 2,
    });
    repository.findActiveSession.mockResolvedValue({
      id: 'session-1',
      userId: 'user-1',
      authVersion: 2,
    });
    users.findByIdForAuthentication.mockResolvedValue({
      id: 'user-1',
      status: 'active',
      authVersion: 2,
      roles: [{ key: 'user', permissions: ['users.read'] }],
    });

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request.user).toEqual(
      expect.objectContaining({ userId: 'user-1', permissions: ['users.read'] }),
    );
  });

  it('rejects stale auth versions and revoked sessions', async () => {
    request.headers.authorization = 'Bearer valid.token.value';
    crypto.verifyAccessToken.mockResolvedValue({
      userId: 'user-1',
      sessionId: 'session-1',
      authVersion: 1,
    });
    repository.findActiveSession.mockResolvedValue(null);
    users.findByIdForAuthentication.mockResolvedValue(null);
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(AppException);
  });
});
