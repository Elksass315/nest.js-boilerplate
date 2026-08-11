export const ROLE_KEYS = ['super_admin', 'admin', 'user'] as const;
export type RoleKey = (typeof ROLE_KEYS)[number];

export const PERMISSIONS = [
  'users.read',
  'users.status.manage',
  'users.roles.manage',
  'sessions.read.any',
  'sessions.revoke.any',
] as const;
export type Permission = (typeof PERMISSIONS)[number];
