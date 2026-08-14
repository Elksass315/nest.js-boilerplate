import type { SeedDefinition } from './seed.types';

const roles = [
  [
    '10000000-0000-4000-8000-000000000001',
    'super_admin',
    'Super administrator',
    'Full platform security administration.',
  ],
  [
    '10000000-0000-4000-8000-000000000002',
    'admin',
    'Administrator',
    'Read-only user account administration.',
  ],
  ['10000000-0000-4000-8000-000000000003', 'user', 'User', 'Standard self-service account.'],
] as const;

const permissions = [
  ['20000000-0000-4000-8000-000000000001', 'users.read', 'Read user account records.'],
  ['20000000-0000-4000-8000-000000000002', 'users.status.manage', 'Change user account status.'],
  ['20000000-0000-4000-8000-000000000003', 'users.roles.manage', 'Replace user role assignments.'],
  [
    '20000000-0000-4000-8000-000000000004',
    'sessions.read.any',
    'Read sessions belonging to any user.',
  ],
  [
    '20000000-0000-4000-8000-000000000005',
    'sessions.revoke.any',
    'Revoke sessions belonging to any user.',
  ],
] as const;

const superAdminPermissionIds = permissions.map(([id]) => id);
const adminPermissionIds = [permissions[0][0]];

export const rbacSeed: SeedDefinition = {
  id: '002-rbac',
  description: 'Install immutable system roles and permissions',
  checksumSource: { roles, permissions, superAdminPermissionIds, adminPermissionIds },
  run: async (queryRunner) => {
    for (const [id, key, name, description] of roles) {
      await queryRunner.query(
        'INSERT INTO "authorization_roles" ("id", "key", "name", "description", "is_system") VALUES ($1, $2, $3, $4, true)',
        [id, key, name, description],
      );
    }
    for (const [id, key, description] of permissions) {
      await queryRunner.query(
        'INSERT INTO "authorization_permissions" ("id", "key", "description") VALUES ($1, $2, $3)',
        [id, key, description],
      );
    }
    let assignment = 1;
    for (const permissionId of superAdminPermissionIds) {
      await queryRunner.query(
        'INSERT INTO "authorization_role_permissions" ("id", "role_id", "permission_id") VALUES ($1, $2, $3)',
        [
          `30000000-0000-4000-8000-${assignment.toString().padStart(12, '0')}`,
          roles[0][0],
          permissionId,
        ],
      );
      assignment += 1;
    }
    for (const permissionId of adminPermissionIds) {
      await queryRunner.query(
        'INSERT INTO "authorization_role_permissions" ("id", "role_id", "permission_id") VALUES ($1, $2, $3)',
        [
          `30000000-0000-4000-8000-${assignment.toString().padStart(12, '0')}`,
          roles[1][0],
          permissionId,
        ],
      );
      assignment += 1;
    }
  },
};
