import { createRateLimitConfig } from './rate-limit.config';

describe('rate limit configuration', () => {
  it('maps the window and request limit', () => {
    expect(createRateLimitConfig({ RATE_LIMIT_TTL_MS: 60_000, RATE_LIMIT_MAX: 100 })).toEqual({
      ttlMs: 60_000,
      max: 100,
    });
  });
});
