import { Test } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';

import { RequestContextService } from '@/core/request-context/request-context.service';
import { AuthorizationService, type RoleDefinition } from '@/modules/authorization';

import { UserEntity } from './entities/user.entity';
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
    lockSuperAdminPolicy: jest.fn(),
    hasRole: jest.fn(),
    countActiveUsersWithRole: jest.fn(),
    findByIdForUpdate: jest.fn(),
    saveWithAudit: jest.fn(),
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
  const dataSource = {
    transaction: jest.fn(async (work: (manager: never) => Promise<unknown>) => work({} as never)),
  };
  let service: UsersService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: UsersRepository, useValue: repository },
        { provide: AuthorizationService, useValue: authorization },
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
      service.createPendingUser({
        fullName: 'Amina Hassan',
        email: user.email,
        normalizedEmail: user.normalizedEmail,
        passwordHash: '$argon2id$new',
      }),
    ).rejects.toMatchObject({ status: 409 });
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
});
