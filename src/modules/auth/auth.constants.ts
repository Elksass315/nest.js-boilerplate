export type AuthTokenPurpose = 'password_reset';

export type TwoStepPurpose = 'login' | 'enable' | 'disable' | 'recovery_regenerate';

export type RefreshTokenStatus = 'active' | 'rotated' | 'revoked';

export type SessionRevokeReason =
  | 'logout'
  | 'user_requested'
  | 'password_changed'
  | 'password_reset'
  | 'refresh_reuse'
  | 'session_limit';
