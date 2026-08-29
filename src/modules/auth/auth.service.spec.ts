import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';

import { AppException } from '@/core/errors/app.exception';
import { MailService } from '@/modules/mail';
import { UsersService, type UserWithRoles } from '@/modules/users';

import { AuthCryptoService } from './auth-crypto.service';
import { AuthRepository } from './auth.repository';
import { AuthService } from './auth.service';
import type { AuthSessionEntity } from './entities/auth-session.entity';

describe(AuthService.name, () => {
  async function expectErrorCode(promise: Promise<unknown>, code: string): Promise<void> {
    try {
      await promise;
      throw new Error(`Expected ${code}`);
    } catch (error) {
      if (!(error instanceof AppException)) throw error;
      expect(error.getResponse()).toEqual(expect.objectContaining({ code }));
    }
  }

  const user: UserWithRoles = {
    id: '7b3f8ed4-73ef-4afe-8703-b10dd32f3820',
    fullName: 'Amina Hassan',
    email: 'amina@example.com',
    normalizedEmail: 'amina@example.com',
    passwordHash: '$argon2id$example',
    status: 'active',
    emailVerifiedAt: new Date('2026-08-12T10:00:00.000Z'),
    emailTwoStepEnabled: false,
    authVersion: 3,
    failedLoginCount: 0,
    lockedUntil: null,
    createdAt: new Date('2026-08-12T09:00:00.000Z'),
    updatedAt: new Date('2026-08-12T10:00:00.000Z'),
    roles: [],
    avatarFileId: null,
  };
  const session = {
    id: 'b8f10c56-5e3c-42ee-8436-7994b9691ced',
    userId: user.id,
    authVersion: user.authVersion,
    createdAt: new Date('2026-08-12T10:00:00.000Z'),
    updatedAt: new Date('2026-08-12T10:00:00.000Z'),
    lastUsedAt: new Date('2026-08-12T11:00:00.000Z'),
    expiresAt: new Date('2099-08-26T10:00:00.000Z'),
    revokedAt: null,
    revokeReason: null,
  } as AuthSessionEntity;
  const repository = {
    issueActionToken: jest.fn(),
    findActionTokenForUpdate: jest.fn(),
    consumeActionToken: jest.fn(),
    enforceSessionLimit: jest.fn(),
    lockUserSessions: jest.fn(),
    createSession: jest.fn(),
    findRefreshForUpdate: jest.fn(),
    findSessionForUpdate: jest.fn(),
    revokeSession: jest.fn(),
    saveSession: jest.fn(),
    rotateRefresh: jest.fn(),
    revokeAllForUser: jest.fn(),
    findPage: jest.fn(),
    issueTwoStepChallenge: jest.fn(),
    findTwoStepChallengeForUpdate: jest.fn(),
    saveTwoStepChallenge: jest.fn(),
    replaceRecoveryCodes: jest.fn(),
    findRecoveryCodesForUpdate: jest.fn(),
    consumeRecoveryCode: jest.fn(),
    deleteRecoveryCodes: jest.fn(),
    issueEmailVerificationCode: jest.fn(),
    findEmailVerificationCodeForUpdate: jest.fn(),
    saveEmailVerificationCode: jest.fn(),
    cleanupOperationalData: jest.fn(),
  };
  const crypto = {
    hashPassword: jest.fn(),
    verifyPassword: jest.fn(),
    verifyDummyPassword: jest.fn(),
    opaqueToken: jest.fn(),
    hashToken: jest.fn(),
    signAccessToken: jest.fn(),
    hashSecret: jest.fn(),
    verifySecret: jest.fn(),
    numericCode: jest.fn(),
    recoveryCodes: jest.fn(),
  };
  const users = {
    createOrUpdatePendingUser: jest.fn(),
    findForAuthentication: jest.fn(),
    findByIdForAuthentication: jest.fn(),
    verifyEmail: jest.fn(),
    recordFailedLogin: jest.fn(),
    recordSuccessfulLogin: jest.fn(),
    changePassword: jest.fn(),
    setEmailTwoStep: jest.fn(),
    auditRecoveryCodesRegenerated: jest.fn(),
    getSelf: jest.fn(),
  };
  const mail = {
    sendEmailVerification: jest.fn(),
    sendPasswordReset: jest.fn(),
    sendTwoStepCode: jest.fn(),
    sendNewSession: jest.fn(),
    sendForcedSessionRevocation: jest.fn(),
    sendPasswordChanged: jest.fn(),
    sendTwoStepChanged: jest.fn(),
  };
  const dataSource = {
    transaction: jest.fn(async (work: (manager: object) => Promise<unknown>) => work({})),
  };
  let service: AuthService;

  beforeEach(async () => {
    const values: Record<string, number> = {
      'auth.accessTokenTtlSeconds': 900,
      'auth.sessionTtlSeconds': 1_209_600,
      'auth.verificationCodeTtlSeconds': 600,
      'auth.verificationCodeMaxAttempts': 5,
      'auth.passwordResetTokenTtlSeconds': 1_800,
      'auth.maxActiveSessions': 5,
      'auth.maxFailedLoginAttempts': 5,
      'auth.loginLockSeconds': 900,
      'auth.twoStepCodeTtlSeconds': 300,
      'auth.twoStepMaxAttempts': 5,
      'auth.recoveryCodeCount': 10,
    };
    const module = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: AuthRepository, useValue: repository },
        { provide: AuthCryptoService, useValue: crypto },
        { provide: UsersService, useValue: users },
        { provide: MailService, useValue: mail },
        {
          provide: ConfigService,
          useValue: { getOrThrow: (key: string): number => values[key] ?? 0 },
        },
        { provide: getDataSourceToken(), useValue: dataSource },
      ],
    }).compile();
    service = module.get(AuthService);
    crypto.hashPassword.mockResolvedValue('$argon2id$hashed');
    crypto.opaqueToken.mockReturnValue({ raw: 'r'.repeat(43), hash: 'h'.repeat(64) });
    crypto.hashToken.mockReturnValue('h'.repeat(64));
    crypto.signAccessToken.mockResolvedValue('access-token');
    crypto.verifyPassword.mockResolvedValue(true);
    crypto.hashSecret.mockResolvedValue('$argon2id$secret');
    crypto.verifySecret.mockResolvedValue(true);
    crypto.numericCode.mockReturnValue('482913');
    crypto.recoveryCodes.mockReturnValue(['7F3A-91BC-2D44-8E10']);
    users.createOrUpdatePendingUser.mockResolvedValue(user);
    users.recordSuccessfulLogin.mockResolvedValue(user);
    users.findByIdForAuthentication.mockResolvedValue(user);
    users.getSelf.mockResolvedValue({
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      status: user.status,
      emailVerifiedAt: user.emailVerifiedAt?.toISOString() ?? null,
      emailTwoStepEnabled: user.emailTwoStepEnabled,
      emailTwoStepRequired: false,
      roles: [],
      avatar: null,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
    });
    repository.createSession.mockResolvedValue(session);
  });

  it('delegates operational credential cleanup to the owning repository', async () => {
    repository.cleanupOperationalData.mockResolvedValue(4);
    const tokenBefore = new Date('2026-01-01');
    const sessionBefore = new Date('2025-12-01');
    await expect(service.cleanupOperationalData(tokenBefore, sessionBefore, 10)).resolves.toBe(4);
    expect(repository.cleanupOperationalData).toHaveBeenCalledWith(tokenBefore, sessionBefore, 10);
  });

  afterEach(() => jest.clearAllMocks());

  it('registers a normalized pending user and queues branded verification mail', async () => {
    const result = await service.register(' Amina Hassan ', ' AMINA@Example.com ', 'long-password');

    expect(users.createOrUpdatePendingUser).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'amina@example.com', normalizedEmail: 'amina@example.com' }),
      expect.anything(),
    );
    expect(repository.issueEmailVerificationCode).toHaveBeenCalledWith(
      expect.anything(),
      user.id,
      '$argon2id$secret',
      expect.any(Date),
    );
    expect(mail.sendEmailVerification).toHaveBeenCalledWith(
      expect.objectContaining({ email: user.email, code: '482913', expiresInSeconds: 600 }),
      expect.anything(),
    );
    expect(result).toEqual({
      registrationId: user.id,
      verificationExpiresIn: 600,
      message: 'Registration accepted; enter the code sent to your email',
    });
  });

  it('hashes an account password through the configured Argon2id crypto service', async () => {
    await expect(service.hashAccountPassword('strong-password')).resolves.toBe('$argon2id$hashed');
    expect(crypto.hashPassword).toHaveBeenCalledWith('strong-password');
  });

  it('keeps verification resend enumeration-safe', async () => {
    users.findByIdForAuthentication.mockResolvedValue(null);
    await expect(service.resendVerification(user.id)).resolves.toEqual({
      verificationExpiresIn: 600,
      message: 'If the registration is eligible, a verification code will be sent',
    });
    expect(mail.sendEmailVerification).not.toHaveBeenCalled();
  });

  it('commits a replacement verification code and durable mail request on resend', async () => {
    users.findByIdForAuthentication.mockResolvedValue({
      ...user,
      status: 'pending_verification',
      emailVerifiedAt: null,
    });

    await service.resendVerification(user.id);

    expect(repository.issueEmailVerificationCode).toHaveBeenCalledWith(
      expect.anything(),
      user.id,
      '$argon2id$secret',
      expect.any(Date),
    );
    expect(mail.sendEmailVerification).toHaveBeenCalledWith(
      expect.objectContaining({ email: user.email, code: '482913' }),
      expect.anything(),
    );
  });

  it('consumes a valid verification code and activates the account atomically', async () => {
    const verification = {
      userId: user.id,
      codeHash: '$argon2id$secret',
      attempts: 0,
      consumedAt: null,
      expiresAt: new Date('2099-01-01T00:00:00.000Z'),
    };
    repository.findEmailVerificationCodeForUpdate.mockResolvedValue(verification);

    await expect(service.verifyEmail(user.id, '482913')).resolves.toEqual({
      message: 'Email address verified',
    });
    expect(users.verifyEmail).toHaveBeenCalledWith(user.id, expect.anything());
    expect(repository.saveEmailVerificationCode).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ consumedAt: expect.any(Date) }),
    );
  });

  it('persists failed verification attempts and invalidates the fifth failure', async () => {
    const verification = {
      userId: user.id,
      codeHash: '$argon2id$secret',
      attempts: 4,
      consumedAt: null,
      expiresAt: new Date('2099-01-01T00:00:00.000Z'),
    };
    repository.findEmailVerificationCodeForUpdate.mockResolvedValue(verification);
    crypto.verifySecret.mockResolvedValue(false);

    await expectErrorCode(service.verifyEmail(user.id, '000000'), 'VERIFICATION_ATTEMPTS_EXCEEDED');
    expect(verification).toEqual(
      expect.objectContaining({ attempts: 5, consumedAt: expect.any(Date) }),
    );
    expect(repository.saveEmailVerificationCode).toHaveBeenCalled();
  });

  it('rejects unknown or expired verification codes', async () => {
    repository.findEmailVerificationCodeForUpdate.mockResolvedValue(null);
    await expectErrorCode(
      service.verifyEmail(user.id, '482913'),
      'INVALID_OR_EXPIRED_VERIFICATION_CODE',
    );
  });

  it('creates a rotating session after successful login', async () => {
    users.findForAuthentication.mockResolvedValue(user);

    const result = await service.login('AMINA@example.com', 'correct-password');

    expect(repository.enforceSessionLimit).toHaveBeenCalledWith(expect.anything(), user.id, 5);
    expect(repository.lockUserSessions).toHaveBeenCalledWith(expect.anything(), user.id);
    expect(result).toEqual({
      accessToken: 'access-token',
      refreshToken: 'r'.repeat(43),
      tokenType: 'Bearer',
      expiresIn: 900,
      user: expect.objectContaining({ id: user.id, roles: [], permissions: [] }),
    });
  });

  it('issues an emailed challenge instead of a session when two-step is enabled', async () => {
    const protectedUser = { ...user, emailTwoStepEnabled: true };
    users.findForAuthentication.mockResolvedValue(protectedUser);
    users.recordSuccessfulLogin.mockResolvedValue(protectedUser);

    const result = await service.login(user.email, 'correct-password');

    expect(result).toEqual({
      requiresTwoStep: true,
      challengeToken: 'r'.repeat(43),
      expiresIn: 300,
    });
    expect(repository.issueTwoStepChallenge).toHaveBeenCalledWith(
      expect.anything(),
      user.id,
      'login',
      'h'.repeat(64),
      '$argon2id$secret',
      expect.any(Date),
    );
    expect(mail.sendTwoStepCode).toHaveBeenCalledWith(
      expect.objectContaining({ code: '482913', purpose: 'login' }),
      expect.anything(),
    );
    expect(repository.createSession).not.toHaveBeenCalled();
  });

  it('requires a login challenge for an admin without voluntary enrollment', async () => {
    const protectedUser = {
      ...user,
      emailTwoStepEnabled: false,
      roles: [
        {
          id: 'role-admin',
          key: 'admin' as const,
          name: 'Administrator',
          description: 'Administrator',
          permissions: [],
        },
      ],
    };
    users.findForAuthentication.mockResolvedValue(protectedUser);
    users.recordSuccessfulLogin.mockResolvedValue(protectedUser);

    await expect(service.login(user.email, 'correct-password')).resolves.toEqual(
      expect.objectContaining({ requiresTwoStep: true }),
    );
    expect(repository.createSession).not.toHaveBeenCalled();
  });

  it('consumes a valid email challenge and creates the protected session', async () => {
    const protectedUser = { ...user, emailTwoStepEnabled: true };
    users.findByIdForAuthentication.mockResolvedValue(protectedUser);
    repository.findTwoStepChallengeForUpdate.mockResolvedValue({
      userId: user.id,
      purpose: 'login',
      codeHash: '$argon2id$secret',
      attempts: 0,
      consumedAt: null,
      expiresAt: new Date('2099-01-01T00:00:00.000Z'),
    });

    const result = await service.completeLoginTwoStep('c'.repeat(43), {
      method: 'email_code',
      code: '482913',
    });

    expect(result.accessToken).toBe('access-token');
    expect(repository.saveTwoStepChallenge).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ consumedAt: expect.any(Date) }),
    );
    expect(mail.sendNewSession).toHaveBeenCalled();
  });

  it('accepts a login challenge required by role policy without enrollment', async () => {
    const protectedUser = {
      ...user,
      emailTwoStepEnabled: false,
      roles: [
        {
          id: 'role-admin',
          key: 'admin' as const,
          name: 'Administrator',
          description: 'Administrator',
          permissions: [],
        },
      ],
    };
    users.findByIdForAuthentication.mockResolvedValue(protectedUser);
    repository.findTwoStepChallengeForUpdate.mockResolvedValue({
      userId: user.id,
      purpose: 'login',
      codeHash: '$argon2id$secret',
      attempts: 0,
      consumedAt: null,
      expiresAt: new Date('2099-01-01T00:00:00.000Z'),
    });

    await expect(
      service.completeLoginTwoStep('c'.repeat(43), {
        method: 'email_code',
        code: '482913',
      }),
    ).resolves.toEqual(expect.objectContaining({ accessToken: 'access-token' }));
  });

  it('keeps the stable disable conflict for an enrolled administrator', async () => {
    users.findByIdForAuthentication.mockResolvedValue({
      ...user,
      emailTwoStepEnabled: true,
      roles: [
        {
          id: 'role-admin',
          key: 'admin',
          name: 'Administrator',
          description: 'Administrator',
          permissions: [],
        },
      ],
    });

    await expectErrorCode(
      service.requestTwoStepChange(user.id, 'correct-password', 'disable'),
      'TWO_STEP_REQUIRED_FOR_ADMIN_ROLE',
    );
  });

  it('persists failed two-step attempts before returning a stable error', async () => {
    const challenge = {
      userId: user.id,
      purpose: 'login',
      codeHash: '$argon2id$secret',
      attempts: 0,
      consumedAt: null,
      expiresAt: new Date('2099-01-01T00:00:00.000Z'),
    };
    repository.findTwoStepChallengeForUpdate.mockResolvedValue(challenge);
    crypto.verifySecret.mockResolvedValue(false);

    await expectErrorCode(
      service.completeLoginTwoStep('c'.repeat(43), {
        method: 'email_code',
        code: '000000',
      }),
      'INVALID_TWO_STEP_CODE',
    );

    expect(challenge.attempts).toBe(1);
    expect(repository.saveTwoStepChallenge).toHaveBeenCalled();
  });

  it('enables two-step, replaces recovery codes, and revokes existing sessions', async () => {
    repository.findTwoStepChallengeForUpdate.mockResolvedValue({
      userId: user.id,
      purpose: 'enable',
      codeHash: '$argon2id$secret',
      attempts: 0,
      consumedAt: null,
      expiresAt: new Date('2099-01-01T00:00:00.000Z'),
    });
    users.setEmailTwoStep.mockResolvedValue({ ...user, emailTwoStepEnabled: true });

    const result = await service.enableTwoStep(user.id, 'c'.repeat(43), '482913');

    expect(result.recoveryCodes).toEqual(['7F3A-91BC-2D44-8E10']);
    expect(repository.replaceRecoveryCodes).toHaveBeenCalledWith(expect.anything(), user.id, [
      '$argon2id$secret',
    ]);
    expect(users.setEmailTwoStep).toHaveBeenCalledWith(user.id, true);
    expect(repository.revokeAllForUser).toHaveBeenCalled();
    expect(mail.sendTwoStepChanged).toHaveBeenCalledWith(
      expect.objectContaining({ enabled: true }),
    );
  });

  it('uses a dummy verification for unknown credentials', async () => {
    users.findForAuthentication.mockResolvedValue(null);
    await expectErrorCode(service.login('missing@example.com', 'wrong'), 'INVALID_CREDENTIALS');
    expect(crypto.verifyDummyPassword).toHaveBeenCalledWith('wrong');
  });

  it('records a failed password attempt', async () => {
    users.findForAuthentication.mockResolvedValue(user);
    crypto.verifyPassword.mockResolvedValue(false);
    await expect(service.login(user.email, 'wrong')).rejects.toBeInstanceOf(AppException);
    expect(users.recordFailedLogin).toHaveBeenCalledWith(user.id, 5, 900);
  });

  it('keeps locked-account responses enumeration-safe for an invalid password', async () => {
    users.findForAuthentication.mockResolvedValue({
      ...user,
      lockedUntil: new Date(Date.now() + 60_000),
    });
    crypto.verifyPassword.mockResolvedValue(false);

    await expectErrorCode(service.login(user.email, 'wrong'), 'INVALID_CREDENTIALS');

    expect(users.recordFailedLogin).not.toHaveBeenCalled();
  });

  it('allows valid credentials to clear failure suppression', async () => {
    users.findForAuthentication.mockResolvedValue({
      ...user,
      lockedUntil: new Date(Date.now() + 60_000),
    });
    crypto.verifyPassword.mockResolvedValue(true);

    await expect(service.login(user.email, 'correct')).resolves.toEqual(
      expect.objectContaining({ accessToken: 'access-token' }),
    );

    expect(users.recordSuccessfulLogin).toHaveBeenCalledWith(user.id);
  });

  it('revokes a session when a rotated refresh token is reused', async () => {
    repository.findRefreshForUpdate.mockResolvedValue({
      sessionId: session.id,
      status: 'rotated',
    });
    repository.findSessionForUpdate.mockResolvedValue(session);

    await expectErrorCode(service.refresh('old-refresh'), 'REFRESH_TOKEN_REUSED');
    expect(repository.revokeSession).toHaveBeenCalledWith(
      expect.anything(),
      session,
      'refresh_reuse',
    );
  });

  it('rotates an active refresh token', async () => {
    const refresh = {
      sessionId: session.id,
      status: 'active',
      expiresAt: new Date('2099-01-01T00:00:00.000Z'),
    };
    repository.findRefreshForUpdate.mockResolvedValue(refresh);
    repository.findSessionForUpdate.mockResolvedValue(session);

    const result = await service.refresh('active-refresh');

    expect(repository.rotateRefresh).toHaveBeenCalledWith(
      expect.anything(),
      refresh,
      'h'.repeat(64),
      session.expiresAt,
    );
    expect(result.accessToken).toBe('access-token');
  });

  it('requests and completes a password reset without exposing account existence', async () => {
    users.findForAuthentication.mockResolvedValue(user);
    await service.forgotPassword(user.email);
    expect(mail.sendPasswordReset).toHaveBeenCalled();

    repository.findActionTokenForUpdate.mockResolvedValue({
      userId: user.id,
      consumedAt: null,
      expiresAt: new Date('2099-01-01T00:00:00.000Z'),
    });
    await expect(service.resetPassword('t'.repeat(43), 'new-password')).resolves.toEqual({
      message: 'Password reset completed',
    });
    expect(users.changePassword).toHaveBeenCalledWith(
      user.id,
      '$argon2id$hashed',
      'auth.password.reset',
    );
    expect(repository.revokeAllForUser).toHaveBeenCalled();
  });

  it('changes a password and revokes all sessions', async () => {
    users.findByIdForAuthentication.mockResolvedValue(user);
    await service.changePassword(user.id, 'current', 'next-password');
    expect(users.changePassword).toHaveBeenCalledWith(
      user.id,
      '$argon2id$hashed',
      'auth.password.changed',
    );
    expect(repository.revokeAllForUser).toHaveBeenCalled();
  });

  it('returns an explicit offset page and protects session ownership', async () => {
    repository.findPage.mockResolvedValue([[session], 1]);
    const page = await service.listSessions(user.id, 1, 20);
    expect(page.items[0]).toEqual(expect.objectContaining({ id: session.id, revokedAt: null }));

    repository.findSessionForUpdate.mockResolvedValue(session);
    await service.revokeOwnedSession(user.id, session.id);
    expect(repository.revokeSession).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ id: session.id }),
      'user_requested',
    );

    repository.findSessionForUpdate.mockResolvedValue(null);
    await expectErrorCode(service.revokeOwnedSession(user.id, session.id), 'SESSION_NOT_FOUND');
  });
});
