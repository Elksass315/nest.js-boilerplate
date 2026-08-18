export const USER_STATUSES = ['pending_verification', 'active', 'suspended'] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

export type SecurityAuditEvent =
  | 'user.created'
  | 'user.profile.updated'
  | 'user.avatar.changed'
  | 'user.status.changed'
  | 'user.roles.changed'
  | 'auth.email.verified'
  | 'auth.login.failed'
  | 'auth.login.succeeded'
  | 'auth.password.changed'
  | 'auth.password.reset'
  | 'auth.two_step.enabled'
  | 'auth.two_step.disabled'
  | 'auth.recovery_codes.regenerated'
  | 'team.invitation.created'
  | 'team.invitation.resent'
  | 'team.invitation.revoked';
