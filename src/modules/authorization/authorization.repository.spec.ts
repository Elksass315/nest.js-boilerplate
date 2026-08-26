import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';

import { AuthorizationRepository } from './authorization.repository';
import { PermissionEntity } from './entities/permission.entity';
import { RolePermissionEntity } from './entities/role-permission.entity';
import { RoleEntity } from './entities/role.entity';
import { UserPermissionOverrideEntity } from './entities/user-permission-override.entity';

describe(AuthorizationRepository.name, () => {
  const queryBuilder = {
    innerJoin: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    getRawMany: jest.fn(),
  };
  const roles = {
    findAndCount: jest.fn(),
    findOneBy: jest.fn(),
    findBy: jest.fn(),
  };
  const rolePermissions = { createQueryBuilder: jest.fn(() => queryBuilder) };
  let repository: AuthorizationRepository;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        AuthorizationRepository,
        { provide: getRepositoryToken(RoleEntity), useValue: roles },
        { provide: getRepositoryToken(PermissionEntity), useValue: {} },
        { provide: getRepositoryToken(RolePermissionEntity), useValue: rolePermissions },
        {
          provide: getRepositoryToken(UserPermissionOverrideEntity),
          useValue: { find: jest.fn() },
        },
      ],
    }).compile();
    repository = module.get(AuthorizationRepository);
  });

  it('applies stable role lookup and pagination queries', async () => {
    roles.findAndCount.mockResolvedValue([[], 0]);
    roles.findOneBy.mockResolvedValue(null);
    roles.findBy.mockResolvedValue([]);

    await repository.findPage(2, 10);
    await repository.findByKey('admin');
    await repository.findByIds(['10000000-0000-4000-8000-000000000002']);
    await expect(repository.findByIds([])).resolves.toEqual([]);

    expect(roles.findAndCount).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 10, take: 10 }),
    );
    expect(roles.findOneBy).toHaveBeenCalledWith({ key: 'admin' });
  });

  it('groups effective permissions by role identifier', async () => {
    queryBuilder.getRawMany.mockResolvedValue([
      {
        roleId: '10000000-0000-4000-8000-000000000002',
        permissionKey: 'users.read',
      },
    ]);

    await expect(
      repository.findPermissionsByRoleIds(['10000000-0000-4000-8000-000000000002']),
    ).resolves.toEqual(new Map([['10000000-0000-4000-8000-000000000002', ['users.read']]]));
    await expect(repository.findPermissionsByRoleIds([])).resolves.toEqual(new Map());
  });
});
