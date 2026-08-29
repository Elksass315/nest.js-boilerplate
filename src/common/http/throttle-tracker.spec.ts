import { createIdentifierThrottleTracker, createIpThrottleTracker } from './throttle-tracker';

describe('sensitive throttle trackers', () => {
  it('hashes account/challenge identifiers without retaining personal data', () => {
    const first = createIdentifierThrottleTracker({
      ip: '10.0.0.1',
      body: { email: 'User@Example.com' },
    });
    const second = createIdentifierThrottleTracker({
      ip: '10.0.0.2',
      body: { email: 'user@example.com' },
    });

    expect(first).toBe(second);
    expect(first).toMatch(/^id:[a-f0-9]{64}$/);
    expect(first).not.toContain('user@example.com');
  });

  it('tracks the trusted request IP independently and uses it as the identifier fallback', () => {
    const request = { ip: '192.0.2.1', body: {} };
    expect(createIpThrottleTracker(request)).toBe('ip:192.0.2.1');
    expect(createIdentifierThrottleTracker(request)).toBe('ip:192.0.2.1');
  });
});
