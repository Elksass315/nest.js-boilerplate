import { Test } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';

import { RequestContextService } from '@/core/request-context/request-context.service';
import { AuthorizationService, type RoleDefinition } from '@/modules/authorization';
import { FilesService } from '@/modules/files';
import { MailService } from '@/modules/mail';

import { AvatarImageService } from './avatar-image.service';
import { UserEntity } from './entities/user.entity';
import { UserSecurityAuditEntity } from './entities/user-security-audit.entity';
import { UsersRepository } from './users.repository';
import { UsersService } from './users.service';

describe(UsersService.name, () => {
  const user = {
    id: '7b3f8ed4-73ef-4afe-8703-b10dd32f3820',
    fullName: 'Amina Hassan',
    email: 'amina@example.com',
    normalizedEmail: 'amina@example.com',
    passwordHash: '$argon2id$example',
    status: 'active',
    emailVerifiedAt: new Date('2026-08-12T10:00:00.000Z'),
    emailTwoStepEnabled: false,
    authVersion: 1,
    failedLoginCount: 0,
    lockedUntil: null,
    avatarFileId: null,
    createdAt: new Date('2026-08-12T09:45:00.000Z'),
    updatedAt: new Date('2026-08-12T10:05:00.000Z'),
  } as UserEntity;
  const userRole: RoleDefinition = {
    id: '10000000-0000-4000-8000-000000000003',
    key: 'user',
    name: 'User',
    description: 'Standard self-service account.',
    permissions: [],
  };
  const superAdminRole: RoleDefinition = {
    id: '10000000-0000-4000-8000-000000000001',
    key: 'super_admin',
    name: 'Super administrator',
    description: 'Full platform security administration.',
    permissions: [
      'users.read',
      'users.status.manage',
      'users.roles.manage',
      'sessions.read.any',
      'sessions.revoke.any',
    ],
  };
  const repository = {
    findPage: jest.fn(),
    findById: jest.fn(),
    findByNormalizedEmail: jest.fn(),
    roleIdsByUserIds: jest.fn(),
    updateProfile: jest.fn(),
    updateStatus: jest.fn(),
    replaceRoles: jest.fn(),
    createWithRole: jest.fn(),
    lockRegistrationEmail: jest.fn(),
    createActiveWithRole: jest.fn(),
    lockSuperAdminPolicy: jest.fn(),
    hasRole: jest.fn(),
    countActiveUsersWithRole: jest.fn(),
    findByIdForUpdate: jest.fn(),
    saveWithAudit: jest.fn(),
    findSecurityAuditPage: jest.fn(),
  };
  const authorization = {
    resolveRoles: jest.fn(),
    getRequiredRole: jest.fn(),
    requireRoleIds: jest.fn(),
  };
  const context = {
    getRequestId: jest.fn(() => 'request-1'),
    getCorrelationId: jest.fn(() => 'correlation-1'),
  };
  const mail = {
    sendAccountStatusChanged: jest.fn(),
    sendRoleChanged: jest.fn(),
  };
  const files = {
    findPublicDescriptors: jest.fn(),
    readUploadedForOwner: jest.fn(),
    prepareReplacement: jest.fn(),
    claimPrepared: jest.fn(),
    markDeletingForOwner: jest.fn(),
    enqueueClaimCleanup: jest.fn(),
    discardPrepared: jest.fn(),
    scheduleDeletion: jest.fn(),
  };
  const avatarImages = {
    getLimits: jest.fn(() => ({
      maxBytes: 5_242_880,
      maxWidth: 8192,
      maxHeight: 8192,
      maxPixels: 25_000_000,
    })),
    sanitize: jest.fn(),
  };
  const dataSource = {
    transaction: jest.fn(async (work: (manager: never) => Promise<unknown>) => work({} as never)),
  };
  let service: UsersService;

  beforeEach(async () => {
    jest.clearAllMocks();
    user.avatarFileId = null;
    const module = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: UsersRepository, useValue: repository },
        { provide: AuthorizationService, useValue: authorization },
        { provide: FilesService, useValue: files },
        { provide: AvatarImageService, useValue: avatarImages },
        { provide: MailService, useValue: mail },
        { provide: RequestContextService, useValue: context },
        { provide: getDataSourceToken(), useValue: dataSource },
      ],
    }).compile();
    service = module.get(UsersService);
    repository.roleIdsByUserIds.mockResolvedValue(new Map([[user.id, [userRole.id]]]));
    authorization.resolveRoles.mockResolvedValue([userRole]);
    authorization.getRequiredRole.mockImplementation((key: string) =>
      Promise.resolve(key === 'super_admin' ? superAdminRole : userRole),
    );
    files.findPublicDescriptors.mockResolvedValue([]);
  });

  it('returns a paginated user response without credential fields', async () => {
    repository.findPage.mockResolvedValue([[user], 1]);

    const result = await service.list(1, 20);

    expect(result.items[0]).toEqual(
      expect.objectContaining({ id: user.id, roles: ['user'], fullName: 'Amina Hassan' }),
    );
    expect(result.items[0]).not.toHaveProperty('passwordHash');
    expect(result.meta.totalItems).toBe(1);
  });

  it('returns only allowlisted audit details with correlation context', async () => {
    const audit = Object.assign(new UserSecurityAuditEntity(), {
      id: 'a68c1d2a-e244-4d3a-a64f-054763e23f85',
      userId: user.id,
      actorUserId: user.id,
      eventType: 'auth.login.failed' as const,
      requestId: 'request-1',
      correlationId: 'correlation-1',
      metadata: {
        failedLoginCount: 2,
        locked: false,
        email: 'must-not-be-exposed@example.com',
        nested: { unsafe: true },
      },
      createdAt: new Date('2026-08-18T12:00:00.000Z'),
      updatedAt: new Date('2026-08-18T12:00:00.000Z'),
    });
    repository.findSecurityAuditPage.mockResolvedValue([[audit], 1]);

    const result = await service.listOwnSecurityAudits(user.id, 1, 20);

    expect(repository.findSecurityAuditPage).toHaveBeenCalledWith(user.id, 1, 20);
    expect(result.items).toEqual([
      {
        id: audit.id,
        eventType: 'auth.login.failed',
        actorUserId: user.id,
        details: { failedLoginCount: 2, locked: false },
        correlationId: 'correlation-1',
        occurredAt: '2026-08-18T12:00:00.000Z',
      },
    ]);
    expect(result.items[0]).not.toHaveProperty('requestId');
    expect(result.items[0]?.details).not.toHaveProperty('email');
  });

  it('requires the target user before privileged audit lookup', async () => {
    repository.findById.mockResolvedValue(null);

    await expect(service.listUserSecurityAudits(user.id, 1, 20)).rejects.toMatchObject({
      status: 404,
    });
    expect(repository.findSecurityAuditPage).not.toHaveBeenCalled();
  });

  it('records request and correlation IDs when updating a profile', async () => {
    repository.updateProfile.mockResolvedValue(
      Object.assign(new UserEntity(), user, { fullName: 'Amina Ali' }),
    );

    await service.updateOwnProfile(user.id, '  Amina Ali  ');

    expect(repository.updateProfile).toHaveBeenCalledWith(
      expect.anything(),
      user.id,
      'Amina Ali',
      expect.objectContaining({ requestId: 'request-1', correlationId: 'correlation-1' }),
    );
  });

  it('rejects an already registered normalized email', async () => {
    repository.findByNormalizedEmail.mockResolvedValue(user);

    await expect(
      service.createOrUpdatePendingUser({
        fullName: 'Amina Hassan',
        email: user.email,
        normalizedEmail: user.normalizedEmail,
        passwordHash: '$argon2id$new',
      }),
    ).rejects.toMatchObject({ status: 409 });
  });

  it('updates an existing pending registration under the normalized-email lock', async () => {
    const pending = Object.assign(new UserEntity(), user, {
      status: 'pending_verification' as const,
      emailVerifiedAt: null,
    });
    repository.findByNormalizedEmail.mockResolvedValue(pending);
    repository.saveWithAudit.mockImplementation((_manager: unknown, value: UserEntity) =>
      Promise.resolve(value),
    );

    const result = await service.createOrUpdatePendingUser({
      fullName: 'Amina Revised',
      email: user.email,
      normalizedEmail: user.normalizedEmail,
      passwordHash: '$argon2id$new',
    });

    expect(repository.lockRegistrationEmail).toHaveBeenCalledWith(
      expect.anything(),
      user.normalizedEmail,
    );
    expect(repository.saveWithAudit).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ fullName: 'Amina Revised', passwordHash: '$argon2id$new' }),
      expect.objectContaining({ eventType: 'auth.registration.updated' }),
    );
    expect(result.fullName).toBe('Amina Revised');
  });

  it('creates an active invited user in the caller transaction with correlated audit context', async () => {
    repository.createActiveWithRole.mockResolvedValue(user);
    const manager = {} as never;

    await expect(
      service.createInvitedUser(
        manager,
        {
          fullName: user.fullName,
          email: user.email,
          normalizedEmail: user.normalizedEmail,
          passwordHash: user.passwordHash,
        },
        userRole.id,
        '516f56de-a801-47ea-b178-6d64b55da325',
      ),
    ).resolves.toEqual({ id: user.id, fullName: user.fullName, email: user.email });
    expect(repository.createActiveWithRole).toHaveBeenCalledWith(
      manager,
      expect.anything(),
      userRole.id,
      expect.objectContaining({
        eventType: 'team.invitation.accepted',
        correlationId: 'correlation-1',
      }),
    );
  });

  it('protects the last active super administrator from suspension', async () => {
    repository.findById.mockResolvedValue(user);
    repository.hasRole.mockResolvedValue(true);
    repository.countActiveUsersWithRole.mockResolvedValue(1);

    await expect(service.updateStatus(user.id, 'suspended', user.id)).rejects.toMatchObject({
      status: 409,
    });
    expect(repository.updateStatus).not.toHaveBeenCalled();
  });

  it('increments auth state through the repository when roles change', async () => {
    authorization.requireRoleIds.mockResolvedValue([userRole]);
    repository.findById.mockResolvedValue(user);
    repository.hasRole.mockResolvedValue(false);
    repository.replaceRoles.mockResolvedValue(
      Object.assign(new UserEntity(), user, { authVersion: 2 }),
    );

    await service.replaceRoles(user.id, [userRole.id], superAdminRole.id);

    expect(repository.replaceRoles).toHaveBeenCalledWith(
      expect.anything(),
      user.id,
      [userRole.id],
      expect.objectContaining({
        actorUserId: superAdminRole.id,
        correlationId: 'correlation-1',
      }),
    );
    expect(mail.sendRoleChanged).toHaveBeenCalledWith(
      expect.objectContaining({ email: user.email, roles: ['user'] }),
    );
  });

  it('notifies the user after a status change is persisted', async () => {
    repository.findById.mockResolvedValue(user);
    repository.hasRole.mockResolvedValue(false);
    repository.updateStatus.mockResolvedValue(
      Object.assign(new UserEntity(), user, { status: 'suspended' as const }),
    );

    await service.updateStatus(user.id, 'suspended', superAdminRole.id);

    expect(mail.sendAccountStatusChanged).toHaveBeenCalledWith(
      expect.objectContaining({ email: user.email, status: 'suspended' }),
    );
  });

  it('activates verified users and records correlated authentication state', async () => {
    const pending = Object.assign(new UserEntity(), user, {
      status: 'pending_verification' as const,
      emailVerifiedAt: null,
    });
    repository.findByIdForUpdate.mockResolvedValue(pending);
    repository.saveWithAudit.mockImplementation((_manager: unknown, value: UserEntity) =>
      Promise.resolve(value),
    );

    const verified = await service.verifyEmail(user.id);
    expect(verified.status).toBe('active');
    expect(repository.saveWithAudit).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ emailVerifiedAt: expect.any(Date) }),
      expect.objectContaining({ eventType: 'auth.email.verified', correlationId: 'correlation-1' }),
    );
  });

  it('locks repeated failed logins and clears counters after success', async () => {
    const mutable = Object.assign(new UserEntity(), user, {
      failedLoginCount: 4,
      lockedUntil: null,
    });
    repository.findByIdForUpdate.mockResolvedValue(mutable);
    repository.saveWithAudit.mockImplementation((_manager: unknown, value: UserEntity) =>
      Promise.resolve(value),
    );

    await service.recordFailedLogin(user.id, 5, 900);
    expect(mutable.lockedUntil).toBeInstanceOf(Date);

    const authenticated = await service.recordSuccessfulLogin(user.id);
    expect(authenticated.failedLoginCount).toBe(0);
    expect(authenticated.lockedUntil).toBeNull();
  });

  it('changes a password, increments authVersion, and audits the event', async () => {
    const mutable = Object.assign(new UserEntity(), user);
    repository.findByIdForUpdate.mockResolvedValue(mutable);
    repository.saveWithAudit.mockResolvedValue(mutable);

    await service.changePassword(user.id, '$argon2id$new', 'auth.password.changed');

    expect(mutable.passwordHash).toBe('$argon2id$new');
    expect(mutable.authVersion).toBe(2);
    expect(repository.saveWithAudit).toHaveBeenCalledWith(
      expect.anything(),
      mutable,
      expect.objectContaining({ eventType: 'auth.password.changed' }),
    );
  });

  it('changes email two-step state, increments authVersion, and audits correlation', async () => {
    const mutable = Object.assign(new UserEntity(), user);
    repository.findByIdForUpdate.mockResolvedValue(mutable);
    repository.saveWithAudit.mockImplementation((_manager: unknown, value: UserEntity) =>
      Promise.resolve(value),
    );

    const updated = await service.setEmailTwoStep(user.id, true);

    expect(updated.emailTwoStepEnabled).toBe(true);
    expect(updated.authVersion).toBe(2);
    expect(repository.saveWithAudit).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ emailTwoStepEnabled: true, authVersion: 2 }),
      expect.objectContaining({
        eventType: 'auth.two_step.enabled',
        requestId: 'request-1',
        correlationId: 'correlation-1',
      }),
    );
  });

  it('sanitizes and atomically attaches an owned avatar with correlated cleanup', async () => {
    const mutable = Object.assign(new UserEntity(), user, {
      avatarFileId: '11111111-1111-4111-8111-111111111111',
    });
    repository.findById.mockResolvedValue(mutable);
    repository.findByIdForUpdate.mockResolvedValue(mutable);
    repository.saveWithAudit.mockImplementation((_manager: unknown, value: UserEntity) =>
      Promise.resolve(value),
    );
    files.readUploadedForOwner.mockResolvedValue({
      fileId: '22222222-2222-4222-8222-222222222222',
      originalName: 'avatar.webp',
      declaredMimeType: 'image/webp',
      sizeBytes: 4,
      bytes: Buffer.from('raw'),
    });
    avatarImages.sanitize.mockResolvedValue({ bytes: Buffer.from('safe'), mimeType: 'image/webp' });
    files.prepareReplacement.mockResolvedValue({
      fileId: '22222222-2222-4222-8222-222222222222',
      provider: 'local',
      storageKey: 'ready/new',
      mimeType: 'image/webp',
      sizeBytes: 4,
      checksumSha256: 'checksum',
    });
    files.claimPrepared.mockResolvedValue({
      fileId: '22222222-2222-4222-8222-222222222222',
      publicId: '33333333-3333-4333-8333-333333333333',
      url: 'http://localhost:3000/api/v1/files/public/33333333-3333-4333-8333-333333333333',
      mimeType: 'image/webp',
      sizeBytes: 4,
    });

    const result = await service.replaceOwnAvatar(user.id, '22222222-2222-4222-8222-222222222222');

    expect(files.markDeletingForOwner).toHaveBeenCalledWith(
      expect.anything(),
      '11111111-1111-4111-8111-111111111111',
      user.id,
      'user_avatar',
    );
    expect(repository.saveWithAudit).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ avatarFileId: '22222222-2222-4222-8222-222222222222' }),
      expect.objectContaining({ eventType: 'user.avatar.changed', correlationId: 'correlation-1' }),
    );
    expect(files.enqueueClaimCleanup).toHaveBeenCalledWith(
      '22222222-2222-4222-8222-222222222222',
      '11111111-1111-4111-8111-111111111111',
      'correlation-1',
    );
    expect(result.avatar).toEqual(expect.objectContaining({ mimeType: 'image/webp', size: 4 }));
  });

  it('returns an already attached avatar idempotently without processing bytes', async () => {
    const attached = Object.assign(new UserEntity(), user, {
      avatarFileId: '22222222-2222-4222-8222-222222222222',
    });
    repository.findById.mockResolvedValue(attached);
    files.findPublicDescriptors.mockResolvedValue([
      {
        fileId: attached.avatarFileId,
        publicId: '33333333-3333-4333-8333-333333333333',
        url: 'http://localhost:3000/api/v1/files/public/33333333-3333-4333-8333-333333333333',
        mimeType: 'image/png',
        sizeBytes: 12,
      },
    ]);

    const result = await service.replaceOwnAvatar(user.id, attached.avatarFileId);

    expect(result.avatar?.fileId).toBe(attached.avatarFileId);
    expect(files.readUploadedForOwner).not.toHaveBeenCalled();
  });

  it('discards staged bytes when the avatar transaction fails', async () => {
    repository.findById.mockResolvedValue(user);
    repository.findByIdForUpdate.mockRejectedValue(new Error('transaction failed'));
    files.readUploadedForOwner.mockResolvedValue({
      fileId: '22222222-2222-4222-8222-222222222222',
      originalName: 'avatar.png',
      declaredMimeType: 'image/png',
      sizeBytes: 3,
      bytes: Buffer.from('raw'),
    });
    avatarImages.sanitize.mockResolvedValue({ bytes: Buffer.from('safe'), mimeType: 'image/png' });
    const prepared = {
      fileId: '22222222-2222-4222-8222-222222222222',
      provider: 'local' as const,
      storageKey: 'ready/new',
      mimeType: 'image/png',
      sizeBytes: 4,
      checksumSha256: 'checksum',
    };
    files.prepareReplacement.mockResolvedValue(prepared);

    await expect(service.replaceOwnAvatar(user.id, prepared.fileId)).rejects.toThrow(
      'transaction failed',
    );
    expect(files.discardPrepared).toHaveBeenCalledWith(prepared);
  });

  it('detaches an avatar once and schedules deletion after commit', async () => {
    const mutable = Object.assign(new UserEntity(), user, {
      avatarFileId: '11111111-1111-4111-8111-111111111111',
    });
    repository.findByIdForUpdate.mockResolvedValue(mutable);
    repository.saveWithAudit.mockResolvedValue(mutable);

    await service.deleteOwnAvatar(user.id);

    expect(mutable.avatarFileId).toBeNull();
    expect(files.markDeletingForOwner).toHaveBeenCalled();
    expect(files.scheduleDeletion).toHaveBeenCalledWith(
      '11111111-1111-4111-8111-111111111111',
      'correlation-1',
    );
  });
});
