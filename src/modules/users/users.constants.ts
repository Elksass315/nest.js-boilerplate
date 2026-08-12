export const USER_STATUSES = ['pending_verification', 'active', 'suspended'] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

export type SecurityAuditEvent =
  | 'user.created'
  | 'user.profile.updated'
  | 'user.status.changed'
  | 'user.roles.changed'
  | 'auth.email.verified'
  | 'auth.login.failed'
  | 'auth.login.succeeded'
  | 'auth.password.changed'
  | 'auth.password.reset';
