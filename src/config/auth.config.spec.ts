import { createAuthConfig } from './auth.config';

describe('auth configuration', () => {
  it('maps token, session, and recovery policies', () => {
    expect(
      createAuthConfig({
        AUTH_ACCESS_TOKEN_SECRET: 'secret',
        AUTH_TOKEN_ISSUER: 'issuer',
        AUTH_TOKEN_AUDIENCE: 'audience',
        AUTH_ACCESS_TOKEN_TTL_SECONDS: 900,
        AUTH_SESSION_TTL_SECONDS: 1209600,
        AUTH_VERIFICATION_CODE_TTL_SECONDS: 600,
        AUTH_VERIFICATION_CODE_MAX_ATTEMPTS: 5,
        AUTH_PASSWORD_RESET_TOKEN_TTL_SECONDS: 1800,
        AUTH_MAX_ACTIVE_SESSIONS: 5,
        AUTH_MAX_FAILED_LOGIN_ATTEMPTS: 5,
        AUTH_LOGIN_LOCK_SECONDS: 900,
        AUTH_TWO_STEP_CODE_TTL_SECONDS: 300,
        AUTH_TWO_STEP_MAX_ATTEMPTS: 5,
        AUTH_RECOVERY_CODE_COUNT: 10,
      }),
    ).toEqual({
      accessTokenSecret: 'secret',
      tokenIssuer: 'issuer',
      tokenAudience: 'audience',
      accessTokenTtlSeconds: 900,
      sessionTtlSeconds: 1209600,
      verificationCodeTtlSeconds: 600,
      verificationCodeMaxAttempts: 5,
      passwordResetTokenTtlSeconds: 1800,
      maxActiveSessions: 5,
      maxFailedLoginAttempts: 5,
      loginLockSeconds: 900,
      twoStepCodeTtlSeconds: 300,
      twoStepMaxAttempts: 5,
      recoveryCodeCount: 10,
    });
  });
});
