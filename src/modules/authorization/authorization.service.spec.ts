import { Test } from '@nestjs/testing';

import { AuthorizationRepository } from './authorization.repository';
import { AuthorizationService } from './authorization.service';
import type { RoleEntity } from './entities/role.entity';

describe(AuthorizationService.name, () => {
  const role = {
    id: '10000000-0000-4000-8000-000000000002',
    key: 'admin',
    name: 'Administrator',
    description: 'Read-only user account administration.',
  } as RoleEntity;
  const repository = {
    findPage: jest.fn(),
    findByKey: jest.fn(),
    findByIds: jest.fn(),
    findPermissionsByRoleIds: jest.fn(),
  };
  let service: AuthorizationService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [AuthorizationService, { provide: AuthorizationRepository, useValue: repository }],
    }).compile();
    service = module.get(AuthorizationService);
    repository.findPermissionsByRoleIds.mockResolvedValue(new Map([[role.id, ['users.read']]]));
  });

  it('returns an explicit offset page with effective permissions', async () => {
    repository.findPage.mockResolvedValue([[role], 1]);

    await expect(service.listRoles(1, 20)).resolves.toEqual({
      items: [
        {
          id: role.id,
          key: role.key,
          name: role.name,
          description: role.description,
          permissions: ['users.read'],
        },
      ],
      meta: {
        page: 1,
        limit: 20,
        totalItems: 1,
        totalPages: 1,
        hasNextPage: false,
        hasPreviousPage: false,
      },
    });
  });

  it('rejects an unknown required role with a stable error', async () => {
    repository.findByKey.mockResolvedValue(null);

    await expect(service.getRequiredRole('user')).rejects.toMatchObject({ status: 404 });
  });

  it('rejects a role set when any identifier is unknown', async () => {
    repository.findByIds.mockResolvedValue([role]);

    await expect(
      service.requireRoleIds([role.id, '20000000-0000-4000-8000-000000000099']),
    ).rejects.toMatchObject({ status: 404 });
  });
});
