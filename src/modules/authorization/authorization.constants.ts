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
  'feature-flags.read',
  'feature-flags.manage',
  'users.permissions.manage',
] as const;
export type Permission = (typeof PERMISSIONS)[number];

export const AUTHENTICATED_ROUTE_KEY = 'authorization:authenticated';
export const REQUIRED_PERMISSIONS_KEY = 'authorization:permissions';
export const PUBLIC_ROUTE_KEY = 'authorization:public';
