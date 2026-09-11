import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';

import { RequestContextService } from '@/core/request-context/request-context.service';
import { AuthorizationService, type RoleDefinition } from '@/modules/authorization';
import { MailService } from '@/modules/mail';

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
    applyUserOverridesForUsers: jest.fn((roles: Map<string, RoleDefinition[]>) =>
      Promise.resolve(roles),
    ),
    getUserPermissionOverrides: jest.fn(),
    resolvePermissionKeys: jest.fn(),
    replaceUserPermissionOverrides: jest.fn(),
  };
  const context = {
    getRequestId: jest.fn(() => 'request-1'),
    getCorrelationId: jest.fn(() => 'correlation-1'),
  };
  const mail = {
    sendAccountStatusChanged: jest.fn(),
    sendRoleChanged: jest.fn(),
  };
  const dataSource = {
    transaction: jest.fn(async (work: (manager: never) => Promise<unknown>) => work({} as never)),
  };
  let service: UsersService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: UsersRepository, useValue: repository },
        { provide: AuthorizationService, useValue: authorization },
        { provide: MailService, useValue: mail },
        { provide: RequestContextService, useValue: context },
        { provide: getDataSourceToken(), useValue: dataSource },
        {
          provide: ConfigService,
          useValue: { getOrThrow: jest.fn().mockReturnValue('forced') },
        },
      ],
    }).compile();
    service = module.get(UsersService);
    repository.roleIdsByUserIds.mockResolvedValue(new Map([[user.id, [userRole.id]]]));
    authorization.resolveRoles.mockResolvedValue([userRole]);
    authorization.getRequiredRole.mockImplementation((key: string) =>
      Promise.resolve(key === 'super_admin' ? superAdminRole : userRole),
    );
  });

  it('returns a paginated user response without credential fields', async () => {
    repository.findPage.mockResolvedValue([[user], 1]);

    const result = await service.list(1, 20);

    expect(result.items[0]).toEqual(
      expect.objectContaining({ id: user.id, roles: ['user'], fullName: 'Amina Hassan' }),
    );
    expect(result.items[0]).not.toHaveProperty('passwordHash');
    expect(result.items[0]).toEqual(expect.objectContaining({ emailTwoStepRequired: false }));
    expect(result.meta.totalItems).toBe(1);
  });

  it('derives required two-step policy from privileged roles', async () => {
    repository.findPage.mockResolvedValue([[user], 1]);
    repository.roleIdsByUserIds.mockResolvedValue(new Map([[user.id, [superAdminRole.id]]]));
    authorization.resolveRoles.mockResolvedValue([superAdminRole]);

    const result = await service.list(1, 20);

    expect(result.items[0]).toEqual(
      expect.objectContaining({
        emailTwoStepEnabled: false,
        emailTwoStepRequired: true,
        roles: ['super_admin'],
      }),
    );
  });

  it('batches override resolution for a user collection', async () => {
    repository.findPage.mockResolvedValue([
      [user, Object.assign(new UserEntity(), user, { id: 'user-2' })],
      2,
    ]);
    repository.roleIdsByUserIds.mockResolvedValue(
      new Map([
        [user.id, [userRole.id]],
        ['user-2', [userRole.id]],
      ]),
    );

    await service.list(1, 20);

    expect(authorization.applyUserOverridesForUsers).toHaveBeenCalledTimes(1);
    expect(authorization.applyUserOverridesForUsers).toHaveBeenCalledWith(
      expect.objectContaining({ size: 2 }),
    );
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
      expect.anything(),
    );
  });

  it('does not change voluntary two-step enrollment when roles change', async () => {
    authorization.requireRoleIds.mockResolvedValue([superAdminRole]);
    repository.findById.mockResolvedValue(
      Object.assign(new UserEntity(), user, { emailTwoStepEnabled: true }),
    );
    repository.hasRole.mockResolvedValue(false);
    repository.replaceRoles.mockResolvedValue(
      Object.assign(new UserEntity(), user, { emailTwoStepEnabled: true }),
    );

    const result = await service.replaceRoles(user.id, [superAdminRole.id], superAdminRole.id);

    expect(repository.replaceRoles).toHaveBeenCalledWith(
      expect.anything(),
      user.id,
      [superAdminRole.id],
      expect.anything(),
    );
    expect(result.emailTwoStepEnabled).toBe(true);
    expect(result.emailTwoStepRequired).toBe(true);
  });

  it('rejects permission mutation authorized only by a delegated permission', async () => {
    await expect(
      service.replacePermissionOverrides(
        user.id,
        { grants: ['feature-flags.read'], revokes: [] },
        'actor-1',
        ['admin'],
      ),
    ).rejects.toMatchObject({ status: 403 });
    expect(repository.findById).not.toHaveBeenCalled();
  });

  it('rejects protected permission grants even from a super administrator', async () => {
    await expect(
      service.replacePermissionOverrides(
        user.id,
        { grants: ['users.roles.manage'], revokes: [] },
        'actor-1',
        ['super_admin'],
      ),
    ).rejects.toMatchObject({ status: 403 });
    expect(repository.findById).not.toHaveBeenCalled();
  });

  it('rejects permission override changes for super-admin targets', async () => {
    repository.findById.mockResolvedValue(user);
    repository.roleIdsByUserIds.mockResolvedValue(new Map([[user.id, [superAdminRole.id]]]));
    authorization.resolveRoles.mockResolvedValue([superAdminRole]);

    await expect(
      service.replacePermissionOverrides(
        user.id,
        { grants: ['feature-flags.read'], revokes: [] },
        'actor-1',
        ['super_admin'],
      ),
    ).rejects.toMatchObject({ status: 403 });
  });

  it('persists and audits ordinary overrides from a real super administrator', async () => {
    const target = Object.assign(new UserEntity(), user);
    repository.findById.mockResolvedValue(target);
    repository.roleIdsByUserIds.mockResolvedValue(new Map([[target.id, [userRole.id]]]));
    authorization.resolveRoles.mockResolvedValue([userRole]);
    authorization.resolvePermissionKeys.mockResolvedValue(
      new Map([
        ['feature-flags.read', 'permission-1'],
        ['sessions.read.any', 'permission-2'],
      ]),
    );
    authorization.getUserPermissionOverrides.mockResolvedValue([
      { key: 'feature-flags.read', effect: 'grant' },
      { key: 'sessions.read.any', effect: 'revoke' },
    ]);
    const withEffectiveGrant = (
      rolesByUser: Map<string, RoleDefinition[]>,
    ): Promise<Map<string, RoleDefinition[]>> =>
      Promise.resolve(
        new Map(
          [...rolesByUser].map(([userId, roles]) => [
            userId,
            roles.map((role, index): RoleDefinition => ({
              ...role,
              permissions: index === 0 ? ['feature-flags.read'] : [],
            })),
          ]),
        ),
      );
    authorization.applyUserOverridesForUsers
      .mockImplementationOnce(withEffectiveGrant)
      .mockImplementationOnce(withEffectiveGrant);
    repository.saveWithAudit.mockResolvedValue(target);

    const result = await service.replacePermissionOverrides(
      target.id,
      { grants: ['feature-flags.read'], revokes: ['sessions.read.any'] },
      'actor-1',
      ['super_admin'],
    );

    expect(authorization.replaceUserPermissionOverrides).toHaveBeenCalledWith(
      expect.anything(),
      target.id,
      [
        { permissionId: 'permission-1', effect: 'grant' },
        { permissionId: 'permission-2', effect: 'revoke' },
      ],
    );
    expect(repository.saveWithAudit).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ authVersion: 2 }),
      expect.objectContaining({
        eventType: 'user.permissions.changed',
        actorUserId: 'actor-1',
      }),
    );
    expect(result).toEqual({
      effective: ['feature-flags.read'],
      grants: ['feature-flags.read'],
      revokes: ['sessions.read.any'],
    });
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
      expect.anything(),
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
});
