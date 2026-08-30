import type { SeedDefinition } from './seed.types';

const permission = [
  '20000000-0000-4000-8000-000000000010',
  'users.security-audits.read.any',
  'Read security-audit history across user accounts.',
] as const;
const superAdminRoleId = '10000000-0000-4000-8000-000000000001';
const assignmentId = '30000000-0000-4000-8000-000000000015';

export const securityAuditRbacSeed: SeedDefinition = {
  id: '004-security-audit-rbac',
  description: 'Install cross-user security-audit permission for super administrators',
  checksumSource: { permission, superAdminRoleId, assignmentId },
  run: async (queryRunner) => {
    await queryRunner.query(
      'INSERT INTO "authorization_permissions" ("id", "key", "description") VALUES ($1, $2, $3)',
      permission,
    );
    await queryRunner.query(
      'INSERT INTO "authorization_role_permissions" ("id", "role_id", "permission_id") VALUES ($1, $2, $3)',
      [assignmentId, superAdminRoleId, permission[0]],
    );
  },
};
