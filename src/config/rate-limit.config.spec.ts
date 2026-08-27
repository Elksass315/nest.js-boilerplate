import { createRateLimitConfig, parseTrustedProxyIps } from './rate-limit.config';

describe('rate-limit configuration', () => {
  it('creates named policies and parses trusted proxy IPs', () => {
    const config = createRateLimitConfig({
      RATE_LIMIT_TTL_MS: 1000,
      RATE_LIMIT_MAX: 10,
      RATE_LIMIT_AUTH_TTL_MS: 2000,
      RATE_LIMIT_AUTH_MAX: 2,
      RATE_LIMIT_OTP_TTL_MS: 3000,
      RATE_LIMIT_OTP_MAX: 3,
      RATE_LIMIT_RECOVERY_TTL_MS: 4000,
      RATE_LIMIT_RECOVERY_MAX: 4,
      RATE_LIMIT_EMAIL_TTL_MS: 5000,
      RATE_LIMIT_EMAIL_MAX: 5,
      TRUSTED_PROXY_IPS: '10.0.0.1, 2001:db8::1,10.0.0.1',
    });

    expect(config.global).toEqual({ ttlMs: 1000, max: 10 });
    expect(config.authentication).toEqual({ ttlMs: 2000, max: 2 });
    expect(config.trustedProxyIps).toEqual(['10.0.0.1', '2001:db8::1']);
  });

  it('rejects malformed trusted proxy entries', () => {
    expect(() => parseTrustedProxyIps('not-an-ip')).toThrow('TRUSTED_PROXY_IPS');
  });
});

describe('rate limit configuration compatibility', () => {
  it('maps the window and request limit', () => {
    expect(
      createRateLimitConfig({
        RATE_LIMIT_TTL_MS: 60_000,
        RATE_LIMIT_MAX: 100,
        RATE_LIMIT_AUTH_TTL_MS: 60_000,
        RATE_LIMIT_AUTH_MAX: 20,
        RATE_LIMIT_OTP_TTL_MS: 600_000,
        RATE_LIMIT_OTP_MAX: 5,
        RATE_LIMIT_RECOVERY_TTL_MS: 3_600_000,
        RATE_LIMIT_RECOVERY_MAX: 5,
        RATE_LIMIT_EMAIL_TTL_MS: 3_600_000,
        RATE_LIMIT_EMAIL_MAX: 20,
        TRUSTED_PROXY_IPS: '',
      }),
    ).toEqual(expect.objectContaining({ global: { ttlMs: 60_000, max: 100 } }));
  });
});
