import Joi from 'joi';

import type { SentryConfig } from './configuration.types';
import { readBoolean, readNumber, readString } from './environment-reader';

export const sentryEnvironmentSchema = {
  SENTRY_ENABLED: Joi.boolean().truthy('true').falsy('false').default(false),
  SENTRY_DSN: Joi.string()
    .trim()
    .uri({ scheme: ['http', 'https'] })
    .allow('')
    .default(''),
  SENTRY_ENVIRONMENT: Joi.string().trim().max(64).allow('').default(''),
  SENTRY_RELEASE: Joi.string().trim().max(200).allow('').default(''),
  SENTRY_TRACES_SAMPLE_RATE: Joi.number().min(0).max(1).default(0),
  SENTRY_DEBUG: Joi.boolean().truthy('true').falsy('false').default(false),
} satisfies Record<string, Joi.Schema>;

const standaloneSentryEnvironmentSchema = Joi.object<Record<string, unknown>>({
  NODE_ENV: Joi.string()
    .valid('development', 'test', 'staging', 'production')
    .default('development'),
  ...sentryEnvironmentSchema,
})
  .custom(validateSentryContradictions)
  .messages({
    'environment.sentryDsn': 'SENTRY_DSN must be set exactly when SENTRY_ENABLED is true',
  });

export function createSentryConfig(environment: Record<string, unknown>): SentryConfig {
  const configuredEnvironment = readString(environment, 'SENTRY_ENVIRONMENT');
  return {
    enabled: readBoolean(environment, 'SENTRY_ENABLED'),
    dsn: readString(environment, 'SENTRY_DSN'),
    environment: configuredEnvironment || readString(environment, 'NODE_ENV'),
    release: readString(environment, 'SENTRY_RELEASE'),
    tracesSampleRate: readNumber(environment, 'SENTRY_TRACES_SAMPLE_RATE'),
    debug: readBoolean(environment, 'SENTRY_DEBUG'),
  };
}

function validateSentryContradictions(
  environment: Record<string, unknown>,
  helpers: Joi.CustomHelpers,
): Record<string, unknown> | Joi.ErrorReport {
  return sentryConfigurationAgrees(environment)
    ? environment
    : helpers.error('environment.sentryDsn');
}

export function sentryConfigurationAgrees(environment: Record<string, unknown>): boolean {
  const enabled = environment['SENTRY_ENABLED'] === true;
  const dsn = environment['SENTRY_DSN'];
  const hasDsn = typeof dsn === 'string' && dsn.length > 0;
  return enabled === hasDsn;
}

export function loadSentryConfiguration(
  input: Record<string, unknown> = process.env,
): SentryConfig {
  const result = standaloneSentryEnvironmentSchema.validate(input, {
    abortEarly: false,
    allowUnknown: true,
    convert: true,
    stripUnknown: true,
  });
  if (result.error) {
    throw new Error(`Environment validation failed: ${result.error.message}`);
  }
  return createSentryConfig(result.value);
}
