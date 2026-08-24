import type { Event } from '@sentry/nestjs';

import { sanitizeSentryEvent } from './sentry';

describe('Sentry event privacy', () => {
  it('keeps correlation context while removing sensitive request and user data', () => {
    const event: Event = {
      request: {
        url: 'https://api.example.com/api/v1/users/me?token=secret',
        query_string: 'token=secret',
        cookies: { session: 'secret' },
        data: { password: 'secret' },
        headers: {
          authorization: 'Bearer secret',
          cookie: 'session=secret',
          'x-request-id': 'req-id',
          'x-correlation-id': 'corr-id',
          'user-agent': 'test-client',
        },
      },
      user: { id: 'user-id', email: 'user@example.com', ip_address: '127.0.0.1', username: 'user' },
    };

    const sanitized = sanitizeSentryEvent(event);

    expect(sanitized.tags).toEqual(
      expect.objectContaining({ requestId: 'req-id', correlationId: 'corr-id' }),
    );
    expect(sanitized.request).toEqual(
      expect.objectContaining({
        headers: {
          'x-request-id': 'req-id',
          'x-correlation-id': 'corr-id',
          'user-agent': 'test-client',
        },
      }),
    );
    expect(sanitized.request).not.toHaveProperty('data');
    expect(sanitized.request).not.toHaveProperty('cookies');
    expect(sanitized.request).not.toHaveProperty('query_string');
    expect(sanitized.request?.url).toBe('https://api.example.com/api/v1/users/me');
    expect(sanitized.user).toEqual(expect.objectContaining({ id: 'user-id' }));
    expect(sanitized.user).not.toHaveProperty('email');
    expect(sanitized.user).not.toHaveProperty('ip_address');
    expect(sanitized.user).not.toHaveProperty('username');
  });
});
