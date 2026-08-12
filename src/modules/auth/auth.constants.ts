export type AuthTokenPurpose = 'email_verification' | 'password_reset';

export type RefreshTokenStatus = 'active' | 'rotated' | 'revoked';

export type SessionRevokeReason =
  | 'logout'
  | 'user_requested'
  | 'password_changed'
  | 'password_reset'
  | 'refresh_reuse'
  | 'session_limit';
