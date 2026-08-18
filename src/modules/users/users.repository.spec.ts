import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import type { EntityManager } from 'typeorm';

import { UserRoleEntity } from './entities/user-role.entity';
import { UserSecurityAuditEntity } from './entities/user-security-audit.entity';
import { UserEntity } from './entities/user.entity';
import { UsersRepository } from './users.repository';

describe(UsersRepository.name, () => {
  const user = Object.assign(new UserEntity(), {
    id: '7b3f8ed4-73ef-4afe-8703-b10dd32f3820',
    fullName: 'Amina Hassan',
    email: 'amina@example.com',
    normalizedEmail: 'amina@example.com',
    passwordHash: '$argon2id$example',
    status: 'active' as const,
    emailVerifiedAt: new Date(),
    emailTwoStepEnabled: false,
    authVersion: 1,
    failedLoginCount: 0,
    lockedUntil: null,
  });
  const usersQueryBuilder = {
    innerJoin: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    getCount: jest.fn().mockResolvedValue(1),
  };
  const users = {
    findAndCount: jest.fn().mockResolvedValue([[user], 1]),
    findOneBy: jest.fn().mockResolvedValue(user),
    createQueryBuilder: jest.fn(() => usersQueryBuilder),
  };
  const userRoles = {
    find: jest.fn(),
    existsBy: jest.fn().mockResolvedValue(true),
  };
  const securityAudits = {
    findAndCount: jest.fn().mockResolvedValue([[], 0]),
  };
  const managerUsers = {
    create: jest.fn((value: object) => Object.assign(new UserEntity(), value)),
    save: jest.fn((value: UserEntity) => Promise.resolve(Object.assign(value, { id: user.id }))),
    findOneBy: jest.fn().mockResolvedValue(user),
    createQueryBuilder: jest.fn(() => usersQueryBuilder),
  };
  const managerRoles = {
    create: jest.fn((value: object) => Object.assign(new UserRoleEntity(), value)),
    save: jest.fn().mockResolvedValue(undefined),
    delete: jest.fn().mockResolvedValue(undefined),
    insert: jest.fn().mockResolvedValue(undefined),
    existsBy: jest.fn().mockResolvedValue(true),
  };
  const managerAudits = { save: jest.fn().mockResolvedValue(undefined) };
  const manager = {
    getRepository: jest.fn((entity: unknown) => {
      if (entity === UserEntity) return managerUsers;
      if (entity === UserRoleEntity) return managerRoles;
      return managerAudits;
    }),
    query: jest.fn().mockResolvedValue([]),
  } as unknown as EntityManager;
  let repository: UsersRepository;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        UsersRepository,
        { provide: getRepositoryToken(UserEntity), useValue: users },
        { provide: getRepositoryToken(UserRoleEntity), useValue: userRoles },
        { provide: getRepositoryToken(UserSecurityAuditEntity), useValue: securityAudits },
      ],
    }).compile();
    repository = module.get(UsersRepository);
  });

  it('uses stable pagination, identifiers, email, and assignment lookup', async () => {
    userRoles.find.mockResolvedValue([
      Object.assign(new UserRoleEntity(), { userId: user.id, roleId: 'role-1' }),
    ]);

    await repository.findPage(2, 10);
    await repository.findById(user.id);
    await repository.findByNormalizedEmail(user.normalizedEmail);
    await repository.findSecurityAuditPage(user.id, 2, 10);
    await expect(repository.roleIdsByUserIds([user.id])).resolves.toEqual(
      new Map([[user.id, ['role-1']]]),
    );
    await expect(repository.roleIdsByUserIds([])).resolves.toEqual(new Map());
    await repository.hasRole(user.id, 'role-1');
    await repository.countActiveUsersWithRole('role-1');

    expect(users.findAndCount).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 10, take: 10 }),
    );
    expect(securityAudits.findAndCount).toHaveBeenCalledWith({
      where: { userId: user.id },
      order: { createdAt: 'DESC', id: 'DESC' },
      skip: 10,
      take: 10,
    });
  });

  it('persists account workflows and correlated audits through the supplied transaction manager', async () => {
    const audit = {
      userId: user.id,
      actorUserId: user.id,
      eventType: 'user.profile.updated' as const,
      requestId: 'request-1',
      correlationId: 'correlation-1',
    };

    await repository.createWithRole(
      manager,
      {
        fullName: user.fullName,
        email: user.email,
        normalizedEmail: user.normalizedEmail,
        passwordHash: user.passwordHash,
      },
      'role-1',
      { ...audit, eventType: 'user.created' },
    );
    await repository.createActiveWithRole(
      manager,
      {
        fullName: user.fullName,
        email: user.email,
        normalizedEmail: user.normalizedEmail,
        passwordHash: user.passwordHash,
      },
      'role-1',
      { ...audit, eventType: 'team.invitation.accepted' },
    );
    await repository.updateProfile(manager, user.id, 'Amina Ali', audit);
    await repository.updateStatus(manager, user.id, 'suspended', {
      ...audit,
      eventType: 'user.status.changed',
    });
    await repository.replaceRoles(manager, user.id, ['role-1'], {
      ...audit,
      eventType: 'user.roles.changed',
    });
    await repository.lockSuperAdminPolicy(manager);
    await repository.hasRole(user.id, 'role-1', manager);
    await repository.countActiveUsersWithRole('role-1', manager);

    expect(managerAudits.save).toHaveBeenCalledWith(
      expect.objectContaining({ correlationId: 'correlation-1' }),
    );
    expect(managerUsers.save).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'active', emailVerifiedAt: expect.any(Date) }),
    );
    expect(manager.query).toHaveBeenCalledWith(
      "SELECT pg_advisory_xact_lock(hashtext('users:last-super-admin'))",
    );
  });
});
