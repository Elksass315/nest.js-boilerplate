export const ROLE_KEYS = ['super_admin', 'admin', 'user'] as const;
export type RoleKey = (typeof ROLE_KEYS)[number];

export const PERMISSIONS = [
  'users.read',
  'users.status.manage',
  'users.roles.manage',
  'users.security-audits.read.any',
  'sessions.read.any',
  'sessions.revoke.any',
  'team.invitations.read',
  'team.invitations.create',
  'team.invitations.resend',
  'team.invitations.revoke',
] as const;
export type Permission = (typeof PERMISSIONS)[number];
