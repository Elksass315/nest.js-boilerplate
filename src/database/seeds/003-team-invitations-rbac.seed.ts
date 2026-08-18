import type { SeedDefinition } from './seed.types';

const permissions = [
  [
    '20000000-0000-4000-8000-000000000006',
    'team.invitations.read',
    'Read team invitation records.',
  ],
  [
    '20000000-0000-4000-8000-000000000007',
    'team.invitations.create',
    'Create team invitations within role-assignment authority.',
  ],
  [
    '20000000-0000-4000-8000-000000000008',
    'team.invitations.resend',
    'Rotate and resend pending team invitations.',
  ],
  [
    '20000000-0000-4000-8000-000000000009',
    'team.invitations.revoke',
    'Revoke pending team invitations.',
  ],
] as const;

const roleIds = {
  superAdmin: '10000000-0000-4000-8000-000000000001',
  admin: '10000000-0000-4000-8000-000000000002',
} as const;

export const teamInvitationsRbacSeed: SeedDefinition = {
  id: '003-team-invitations-rbac',
  description: 'Install team invitation permissions for administrators',
  checksumSource: { permissions, roleIds },
  run: async (queryRunner) => {
    for (const [id, key, description] of permissions) {
      await queryRunner.query(
        'INSERT INTO "authorization_permissions" ("id", "key", "description") VALUES ($1, $2, $3)',
        [id, key, description],
      );
    }
    let assignment = 7;
    for (const roleId of [roleIds.superAdmin, roleIds.admin]) {
      for (const [permissionId] of permissions) {
        await queryRunner.query(
          'INSERT INTO "authorization_role_permissions" ("id", "role_id", "permission_id") VALUES ($1, $2, $3)',
          [
            `30000000-0000-4000-8000-${assignment.toString().padStart(12, '0')}`,
            roleId,
            permissionId,
          ],
        );
        assignment += 1;
      }
    }
  },
};
