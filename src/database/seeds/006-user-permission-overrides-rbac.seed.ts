import type { SeedDefinition } from './seed.types';

const permission = [
  '20000000-0000-4000-8000-000000000013',
  'users.permissions.manage',
  'Manage per-user permission grants and revocations.',
] as const;

export const userPermissionOverridesRbacSeed: SeedDefinition = {
  id: '006-user-permission-overrides-rbac',
  description: 'Install per-user permission management for super administrators',
  checksumSource: { permission },
  run: async (queryRunner) => {
    await queryRunner.query(
      'INSERT INTO "authorization_permissions" ("id", "key", "description") VALUES ($1, $2, $3)',
      permission,
    );
    await queryRunner.query(
      'INSERT INTO "authorization_role_permissions" ("id", "role_id", "permission_id") VALUES ($1, $2, $3)',
      [
        '30000000-0000-4000-8000-000000000019',
        '10000000-0000-4000-8000-000000000001',
        permission[0],
      ],
    );
  },
};
