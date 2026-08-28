import { createObservabilityConfig } from './observability.config';

describe('observability configuration', () => {
  it('keeps telemetry disabled by default unless explicitly enabled', () => {
    expect(
      createObservabilityConfig({
        OTEL_ENABLED: false,
        OTEL_SERVICE_NAME: 'test-api',
        OTEL_EXPORTER_OTLP_ENDPOINT: '',
        OTEL_METRIC_EXPORT_INTERVAL_MS: 60_000,
        OTEL_EXPORT_TIMEOUT_MS: 10_000,
      }),
    ).toEqual({
      enabled: false,
      serviceName: 'test-api',
      endpoint: '',
      metricExportIntervalMs: 60_000,
      exportTimeoutMs: 10_000,
    });
  });
});
