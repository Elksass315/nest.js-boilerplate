import { Test } from '@nestjs/testing';

import { AuthorizationRepository } from './authorization.repository';
import { AuthorizationService } from './authorization.service';
import type { RoleDefinition } from './authorization.types';
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
    findUserOverridesByUserIds: jest.fn(),
    findUserOverrides: jest.fn(),
    findPermissionKeysByIds: jest.fn(),
    findPermissionsByKeys: jest.fn(),
    replaceUserOverrides: jest.fn(),
  };
  let service: AuthorizationService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [AuthorizationService, { provide: AuthorizationRepository, useValue: repository }],
    }).compile();
    service = module.get(AuthorizationService);
    repository.findPermissionsByRoleIds.mockResolvedValue(new Map([[role.id, ['users.read']]]));
    repository.findUserOverridesByUserIds.mockResolvedValue([]);
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

  it('resolves overrides for a user collection with two batched repository queries', async () => {
    repository.findUserOverridesByUserIds.mockResolvedValue([
      { userId: 'user-1', permissionId: 'permission-1', effect: 'grant' },
      { userId: 'user-2', permissionId: 'permission-2', effect: 'revoke' },
    ]);
    repository.findPermissionKeysByIds.mockResolvedValue([
      { id: 'permission-1', key: 'feature-flags.read' },
      { id: 'permission-2', key: 'users.read' },
    ]);

    const definition: RoleDefinition = {
      id: role.id,
      key: role.key,
      name: role.name,
      description: role.description,
      permissions: ['users.read'],
    };
    const result = await service.applyUserOverridesForUsers(
      new Map([
        ['user-1', [definition]],
        ['user-2', [definition]],
      ]),
    );

    expect(repository.findUserOverridesByUserIds).toHaveBeenCalledTimes(1);
    expect(repository.findPermissionKeysByIds).toHaveBeenCalledTimes(1);
    expect(result.get('user-1')?.[0]?.permissions).toEqual(['feature-flags.read', 'users.read']);
    expect(result.get('user-2')?.[0]?.permissions).toEqual([]);
  });

  it('applies the batched resolver to a single authentication subject', async () => {
    repository.findUserOverridesByUserIds.mockResolvedValue([]);

    await expect(
      service.applyUserOverrides('user-1', [
        {
          id: role.id,
          key: role.key,
          name: role.name,
          description: role.description,
          permissions: ['users.read'],
        },
      ]),
    ).resolves.toEqual([expect.objectContaining({ key: 'admin', permissions: ['users.read'] })]);
  });

  it('returns catalog keys for persisted user overrides', async () => {
    repository.findUserOverrides.mockResolvedValue([
      { permissionId: 'permission-1', effect: 'grant' },
      { permissionId: 'permission-2', effect: 'revoke' },
    ]);
    repository.findPermissionKeysByIds.mockResolvedValue([
      { id: 'permission-1', key: 'feature-flags.read' },
      { id: 'permission-2', key: 'sessions.read.any' },
    ]);

    await expect(service.getUserPermissionOverrides('user-1')).resolves.toEqual([
      { key: 'feature-flags.read', effect: 'grant' },
      { key: 'sessions.read.any', effect: 'revoke' },
    ]);
  });

  it('resolves permission IDs and delegates transactional replacement', async () => {
    repository.findPermissionsByKeys.mockResolvedValue([
      { id: 'permission-1', key: 'feature-flags.read' },
    ]);
    const manager = {} as never;
    const rows = [{ permissionId: 'permission-1', effect: 'grant' as const }];

    await expect(service.resolvePermissionKeys(['feature-flags.read'])).resolves.toEqual(
      new Map([['feature-flags.read', 'permission-1']]),
    );
    repository.replaceUserOverrides.mockResolvedValue(undefined);
    await expect(
      service.replaceUserPermissionOverrides(manager, 'user-1', rows),
    ).resolves.toBeUndefined();
    expect(repository.replaceUserOverrides).toHaveBeenCalledWith(manager, 'user-1', rows);
  });
});
