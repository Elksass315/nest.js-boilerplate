import type { SeedDefinition } from './seed.types';

const permissions = [
  ['20000000-0000-4000-8000-000000000011', 'feature-flags.read', 'Read global feature flags.'],
  [
    '20000000-0000-4000-8000-000000000012',
    'feature-flags.manage',
    'Create and change global feature flags.',
  ],
] as const;
const assignments = [
  [
    '30000000-0000-4000-8000-000000000016',
    '10000000-0000-4000-8000-000000000001',
    permissions[0][0],
  ],
  [
    '30000000-0000-4000-8000-000000000017',
    '10000000-0000-4000-8000-000000000001',
    permissions[1][0],
  ],
  [
    '30000000-0000-4000-8000-000000000018',
    '10000000-0000-4000-8000-000000000002',
    permissions[0][0],
  ],
] as const;
export const featureFlagsRbacSeed: SeedDefinition = {
  id: '005-feature-flags-rbac',
  description: 'Install feature-flag read and management permissions',
  checksumSource: { permissions, assignments },
  run: async (queryRunner) => {
    for (const permission of permissions)
      await queryRunner.query(
        'INSERT INTO "authorization_permissions" ("id", "key", "description") VALUES ($1, $2, $3)',
        permission,
      );
    for (const assignment of assignments)
      await queryRunner.query(
        'INSERT INTO "authorization_role_permissions" ("id", "role_id", "permission_id") VALUES ($1, $2, $3)',
        assignment,
      );
  },
};
