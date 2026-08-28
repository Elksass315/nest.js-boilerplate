import Joi from 'joi';

import type { ObservabilityConfig } from './configuration.types';
import { readBoolean, readNumber, readString } from './environment-reader';

export const observabilityEnvironmentSchema = {
  OTEL_ENABLED: Joi.boolean().truthy('true').falsy('false').default(false),
  OTEL_SERVICE_NAME: Joi.string().trim().min(1).max(120).default('nestjs-saas'),
  OTEL_EXPORTER_OTLP_ENDPOINT: Joi.string()
    .uri({ scheme: ['http', 'https'] })
    .allow('')
    .default(''),
  OTEL_METRIC_EXPORT_INTERVAL_MS: Joi.number().integer().min(1000).max(3600000).default(60000),
  OTEL_EXPORT_TIMEOUT_MS: Joi.number().integer().min(1000).max(120000).default(10000),
} satisfies Record<string, Joi.Schema>;

export function createObservabilityConfig(
  environment: Record<string, unknown>,
): ObservabilityConfig {
  return {
    enabled: readBoolean(environment, 'OTEL_ENABLED'),
    serviceName: readString(environment, 'OTEL_SERVICE_NAME'),
    endpoint: readString(environment, 'OTEL_EXPORTER_OTLP_ENDPOINT'),
    metricExportIntervalMs: readNumber(environment, 'OTEL_METRIC_EXPORT_INTERVAL_MS'),
    exportTimeoutMs: readNumber(environment, 'OTEL_EXPORT_TIMEOUT_MS'),
  };
}
