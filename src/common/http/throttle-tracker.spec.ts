import { createThrottleTracker } from './throttle-tracker';

describe('createThrottleTracker', () => {
  it('hashes account/challenge identifiers while retaining the client IP', () => {
    const first = createThrottleTracker({ ip: '10.0.0.1', body: { email: 'User@Example.com' } });
    const second = createThrottleTracker({ ip: '10.0.0.1', body: { email: 'user@example.com' } });

    expect(first).toBe(second);
    expect(first).toMatch(/^ip:10\.0\.0\.1:id:[a-f0-9]{64}$/);
    expect(first).not.toContain('user@example.com');
  });

  it('falls back to the trusted request IP when no identifier exists', () => {
    expect(createThrottleTracker({ ip: '192.0.2.1', body: {} })).toBe('ip:192.0.2.1');
  });
});
