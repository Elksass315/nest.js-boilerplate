/* istanbul ignore file */
import { diag, DiagLogLevel } from '@opentelemetry/api';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-proto';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-proto';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';

import { initializeSentry } from './observability/sentry';

const enabled = process.env['OTEL_ENABLED'] === 'true';
const endpoint = process.env['OTEL_EXPORTER_OTLP_ENDPOINT'];

if (enabled && endpoint) {
  diag.setLogger(
    {
      debug: () => undefined,
      error: () => undefined,
      info: () => undefined,
      warn: () => undefined,
      verbose: () => undefined,
    },
    DiagLogLevel.NONE,
  );
  const sdk = new NodeSDK({
    serviceName: process.env['OTEL_SERVICE_NAME'] ?? 'nestjs-saas',
    logRecordProcessors: [],
    traceExporter: new OTLPTraceExporter({ url: `${endpoint.replace(/\/$/, '')}/v1/traces` }),
    metricReaders: [
      new PeriodicExportingMetricReader({
        exporter: new OTLPMetricExporter({ url: `${endpoint.replace(/\/$/, '')}/v1/metrics` }),
        exportIntervalMillis: Number(process.env['OTEL_METRIC_EXPORT_INTERVAL_MS'] ?? 60000),
        exportTimeoutMillis: Number(process.env['OTEL_EXPORT_TIMEOUT_MS'] ?? 10000),
      }),
    ],
    instrumentations: [
      getNodeAutoInstrumentations({
        '@opentelemetry/instrumentation-fs': { enabled: false },
        '@opentelemetry/instrumentation-dns': { enabled: false },
      }),
    ],
  });
  sdk.start();
  process.once('SIGTERM', () => void sdk.shutdown());
  process.once('SIGINT', () => void sdk.shutdown());
}

initializeSentry();
