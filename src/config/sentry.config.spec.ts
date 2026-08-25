import { loadSentryConfiguration } from './sentry.config';

describe('Sentry configuration', () => {
  it('is disabled with zero tracing and no DSN by default', () => {
    expect(loadSentryConfiguration({ NODE_ENV: 'test' })).toEqual({
      enabled: false,
      dsn: '',
      environment: 'test',
      release: '',
      tracesSampleRate: 0,
      debug: false,
    });
  });

  it('loads an explicitly enabled monitored environment', () => {
    expect(
      loadSentryConfiguration({
        NODE_ENV: 'production',
        SENTRY_ENABLED: 'true',
        SENTRY_DSN: 'https://public@example.ingest.sentry.io/1',
        SENTRY_ENVIRONMENT: 'production-eu',
        SENTRY_RELEASE: '1.0.0',
        SENTRY_TRACES_SAMPLE_RATE: '0.1',
      }),
    ).toEqual(expect.objectContaining({ enabled: true, tracesSampleRate: 0.1 }));
  });

  it('rejects contradictory enablement and invalid sample rates', () => {
    expect(() => loadSentryConfiguration({ SENTRY_ENABLED: true, SENTRY_DSN: '' })).toThrow(
      'SENTRY_DSN must be set exactly when SENTRY_ENABLED is true',
    );
    expect(() => loadSentryConfiguration({ SENTRY_TRACES_SAMPLE_RATE: 1.1 })).toThrow(
      'SENTRY_TRACES_SAMPLE_RATE',
    );
  });
});
