export const USER_STATUSES = ['pending_verification', 'active', 'suspended'] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

export const SECURITY_AUDIT_EVENTS = [
  'user.created',
  'user.profile.updated',
  'user.avatar.changed',
  'user.status.changed',
  'user.roles.changed',
  'user.permissions.changed',
  'auth.email.verified',
  'auth.registration.updated',
  'auth.login.failed',
  'auth.login.succeeded',
  'auth.password.changed',
  'auth.password.reset',
  'auth.two_step.enabled',
  'auth.two_step.disabled',
  'auth.recovery_codes.regenerated',
  'team.invitation.created',
  'team.invitation.resent',
  'team.invitation.revoked',
  'team.invitation.accepted',
] as const;
export type SecurityAuditEvent = (typeof SECURITY_AUDIT_EVENTS)[number];
