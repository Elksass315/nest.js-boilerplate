import Joi from 'joi';

import {
  createDatabaseConfig,
  databaseEnvironmentSchema,
  type DatabaseConfig,
} from '@/database/config/database.config';
import { createRedisConfig, redisEnvironmentSchema } from '@/redis/config/redis.config';

import { appEnvironmentSchema, createAppConfig } from './app.config';
import { authEnvironmentSchema, createAuthConfig } from './auth.config';
import {
  capabilityApiEnvironmentSchema,
  capabilityEnvironmentMessages,
  createApiCapabilityConfiguration,
  validateApiCapabilityContradictions,
} from './capability-configuration';
import type { AppConfiguration, MailWorkerConfiguration } from './configuration.types';
import { corsEnvironmentSchema, createCorsConfig, parseCorsOrigins } from './cors.config';
import { createI18nConfig, i18nEnvironmentSchema, parseSupportedLanguages } from './i18n.config';
import { createLoggingConfig, loggingEnvironmentSchema } from './logging.config';
import { createObservabilityConfig, observabilityEnvironmentSchema } from './observability.config';
import { createRetentionConfig, retentionEnvironmentSchema } from './retention.config';
import { createMailConfig, mailEnvironmentSchema } from './mail.config';
import {
  createRateLimitConfig,
  parseTrustedProxyIps,
  rateLimitEnvironmentSchema,
} from './rate-limit.config';
import { createSwaggerConfig, swaggerEnvironmentSchema } from './swagger.config';

const apiEnvironmentSchema = Joi.object<Record<string, unknown>>({
  ...appEnvironmentSchema,
  ...authEnvironmentSchema,
  ...corsEnvironmentSchema,
  ...loggingEnvironmentSchema,
  ...observabilityEnvironmentSchema,
  ...retentionEnvironmentSchema,
  ...swaggerEnvironmentSchema,
  ...rateLimitEnvironmentSchema,
  ...i18nEnvironmentSchema,
  ...mailEnvironmentSchema,
  ...capabilityApiEnvironmentSchema,
  ...databaseEnvironmentSchema,
  ...redisEnvironmentSchema,
})
  .custom(validateApiContradictions)
  .messages({
    'environment.corsOrigins':
      'CORS_ORIGINS must be a comma-separated list of exact HTTP(S) origins without wildcards, paths, queries, or fragments',
    'environment.fallbackLanguage':
      'APP_FALLBACK_LANGUAGE must be included in APP_SUPPORTED_LANGUAGES',
    'environment.redisPassword':
      'REDIS_PASSWORD must contain at least 16 characters in staging and production',
    'environment.swaggerBasicCredentials':
      'SWAGGER_DOCS_USERNAME must contain at least 3 characters and SWAGGER_DOCS_PASSWORD at least 16 characters when SWAGGER_DOCS_ACCESS is basic',
    'environment.swaggerPublicManaged':
      'SWAGGER_DOCS_ACCESS cannot be public in staging or production',
    'environment.swaggerUnusedCredentials':
      'SWAGGER_DOCS_USERNAME and SWAGGER_DOCS_PASSWORD must be empty unless SWAGGER_DOCS_ACCESS is basic',
    'environment.smtpCredentials':
      'MAIL_SMTP_USERNAME and MAIL_SMTP_PASSWORD must either both be set or both be empty',
    ...capabilityEnvironmentMessages,
    'environment.managedSecrets': 'Managed environments cannot use template or synthetic secrets',
    'environment.managedUrls':
      'Managed public URLs and CORS origins must use HTTPS and cannot target localhost or example domains',
    'environment.databaseSecurity':
      'Managed database connections require SSL certificate verification and a password of at least 16 characters',
    'environment.smtpTls': 'MAIL_SMTP_REQUIRE_TLS must be true in staging and production',
    'environment.trustedProxy':
      'TRUSTED_PROXY_IPS must contain an explicit proxy allowlist in staging and production',
    'environment.otelEndpoint':
      'OTEL_EXPORTER_OTLP_ENDPOINT must be configured when OTEL_ENABLED is true',
  });

const databaseOnlyEnvironmentSchema = Joi.object<Record<string, unknown>>({
  ...databaseEnvironmentSchema,
});

const mailWorkerEnvironmentSchema = Joi.object<Record<string, unknown>>({
  ...appEnvironmentSchema,
  ...loggingEnvironmentSchema,
  ...mailEnvironmentSchema,
  ...databaseEnvironmentSchema,
  ...redisEnvironmentSchema,
})
  .custom(validateMailWorkerContradictions)
  .messages({
    'environment.redisPassword':
      'REDIS_PASSWORD must contain at least 16 characters in staging and production',
    'environment.smtpCredentials':
      'MAIL_SMTP_USERNAME and MAIL_SMTP_PASSWORD must either both be set or both be empty',
    'environment.managedSecrets': 'Managed environments cannot use template or synthetic secrets',
    'environment.managedUrls':
      'Managed public URLs must use HTTPS and cannot target localhost or example domains',
    'environment.databaseSecurity':
      'Managed database connections require SSL certificate verification and a password of at least 16 characters',
    'environment.smtpTls': 'MAIL_SMTP_REQUIRE_TLS must be true in staging and production',
  });

function validateApiContradictions(
  environment: Record<string, unknown>,
  helpers: Joi.CustomHelpers,
): Record<string, unknown> | Joi.ErrorReport {
  const nodeEnvironment = environment['NODE_ENV'];
  const swaggerAccess = environment['SWAGGER_DOCS_ACCESS'];
  const swaggerUsername = environment['SWAGGER_DOCS_USERNAME'];
  const swaggerPassword = environment['SWAGGER_DOCS_PASSWORD'];
  const redisPassword = environment['REDIS_PASSWORD'];
  const fallbackLanguage = environment['APP_FALLBACK_LANGUAGE'];
  const supportedLanguages = environment['APP_SUPPORTED_LANGUAGES'];
  const isManaged = nodeEnvironment === 'staging' || nodeEnvironment === 'production';

  if (isManaged && swaggerAccess === 'public') {
    return helpers.error('environment.swaggerPublicManaged');
  }
  if (
    swaggerAccess === 'basic' &&
    (typeof swaggerUsername !== 'string' ||
      swaggerUsername.length < 3 ||
      typeof swaggerPassword !== 'string' ||
      swaggerPassword.length < 16)
  ) {
    return helpers.error('environment.swaggerBasicCredentials');
  }
  if (
    swaggerAccess !== 'basic' &&
    ((typeof swaggerUsername === 'string' && swaggerUsername.length > 0) ||
      (typeof swaggerPassword === 'string' && swaggerPassword.length > 0))
  ) {
    return helpers.error('environment.swaggerUnusedCredentials');
  }
  if (isManaged && managedSecretsAreUnsafe(environment)) {
    return helpers.error('environment.managedSecrets');
  }
  if (isManaged && !managedUrlsAreSafe(environment)) {
    return helpers.error('environment.managedUrls');
  }
  if (isManaged && !databaseSecurityAgrees(environment)) {
    return helpers.error('environment.databaseSecurity');
  }
  if (isManaged && environment['MAIL_SMTP_REQUIRE_TLS'] !== true) {
    return helpers.error('environment.smtpTls');
  }
  const capabilityError = validateApiCapabilityContradictions(environment, helpers);
  if (capabilityError) return capabilityError;
  if (isManaged && !trustedProxyConfigurationAgrees(environment)) {
    return helpers.error('environment.trustedProxy');
  }
  if (isManaged && (typeof redisPassword !== 'string' || redisPassword.length < 16)) {
    return helpers.error('environment.redisPassword');
  }
  if (
    environment['OTEL_ENABLED'] === true &&
    (typeof environment['OTEL_EXPORTER_OTLP_ENDPOINT'] !== 'string' ||
      environment['OTEL_EXPORTER_OTLP_ENDPOINT'].length === 0)
  ) {
    return helpers.error('environment.otelEndpoint');
  }
  if (!smtpCredentialsAgree(environment)) {
    return helpers.error('environment.smtpCredentials');
  }
  if (
    typeof fallbackLanguage !== 'string' ||
    typeof supportedLanguages !== 'string' ||
    !parseSupportedLanguages(supportedLanguages).includes(fallbackLanguage)
  ) {
    return helpers.error('environment.fallbackLanguage');
  }
  return environment;
}

function validateMailWorkerContradictions(
  environment: Record<string, unknown>,
  helpers: Joi.CustomHelpers,
): Record<string, unknown> | Joi.ErrorReport {
  const nodeEnvironment = environment['NODE_ENV'];
  const redisPassword = environment['REDIS_PASSWORD'];
  const isManaged = nodeEnvironment === 'staging' || nodeEnvironment === 'production';
  if (isManaged && managedSecretsAreUnsafe(environment)) {
    return helpers.error('environment.managedSecrets');
  }
  if (isManaged && !managedUrlsAreSafe(environment)) {
    return helpers.error('environment.managedUrls');
  }
  if (isManaged && !databaseSecurityAgrees(environment)) {
    return helpers.error('environment.databaseSecurity');
  }
  if (isManaged && environment['MAIL_SMTP_REQUIRE_TLS'] !== true) {
    return helpers.error('environment.smtpTls');
  }
  if (
    (nodeEnvironment === 'staging' || nodeEnvironment === 'production') &&
    (typeof redisPassword !== 'string' || redisPassword.length < 16)
  ) {
    return helpers.error('environment.redisPassword');
  }
  if (!smtpCredentialsAgree(environment)) {
    return helpers.error('environment.smtpCredentials');
  }
  return environment;
}

function smtpCredentialsAgree(environment: Record<string, unknown>): boolean {
  const username = environment['MAIL_SMTP_USERNAME'];
  const password = environment['MAIL_SMTP_PASSWORD'];
  const hasUsername = typeof username === 'string' && username.length > 0;
  const hasPassword = typeof password === 'string' && password.length > 0;
  return hasUsername === hasPassword;
}

const TEMPLATE_VALUES = new Set([
  'local-only-change-this-access-token-secret',
  'local-database-password',
  'local-redis-password',
  'test',
  'localstack',
]);

function managedSecretsAreUnsafe(environment: Record<string, unknown>): boolean {
  const secretKeys = ['AUTH_ACCESS_TOKEN_SECRET', 'DATABASE_PASSWORD', 'REDIS_PASSWORD'];
  return secretKeys.some((key) => {
    const value = environment[key];
    return (
      typeof value === 'string' &&
      (TEMPLATE_VALUES.has(value) || value.toLowerCase().includes('change-this'))
    );
  });
}

function managedUrlsAreSafe(environment: Record<string, unknown>): boolean {
  const urlKeys = ['APP_BASE_URL', 'MAIL_ACTION_BASE_URL'];
  for (const key of urlKeys) {
    const value = environment[key];
    if (typeof value !== 'string' || value.length === 0) continue;
    if (!isManagedUrl(value)) return false;
  }
  const cors = environment['CORS_ORIGINS'];
  if (typeof cors === 'string') {
    try {
      if (parseCorsOrigins(cors).some((origin) => !isManagedUrl(origin))) return false;
    } catch {
      return false;
    }
  }
  const branding = [environment['MAIL_FROM_ADDRESS'], environment['MAIL_BRANDING_SUPPORT_EMAIL']];
  return branding.every(
    (value) => typeof value !== 'string' || !/@(?:example\.com|example\.test)$/i.test(value),
  );
}

function isManagedUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (
      url.protocol === 'https:' &&
      !['localhost', '127.0.0.1', '::1'].includes(url.hostname) &&
      !/example\.(?:com|test)$/i.test(url.hostname)
    );
  } catch {
    return false;
  }
}

function databaseSecurityAgrees(environment: Record<string, unknown>): boolean {
  return (
    environment['DATABASE_SSL_ENABLED'] === true &&
    environment['DATABASE_REJECT_UNAUTHORIZED'] === true &&
    typeof environment['DATABASE_PASSWORD'] === 'string' &&
    environment['DATABASE_PASSWORD'].length >= 16
  );
}

function trustedProxyConfigurationAgrees(environment: Record<string, unknown>): boolean {
  const value = environment['TRUSTED_PROXY_IPS'];
  if (typeof value !== 'string') return false;
  try {
    return parseTrustedProxyIps(value).length > 0;
  } catch {
    return false;
  }
}

function validateWithSchema(
  schema: Joi.ObjectSchema<Record<string, unknown>>,
  input: Record<string, unknown>,
): Record<string, unknown> {
  const result: Joi.ValidationResult<Record<string, unknown>> = schema.validate(input, {
    abortEarly: false,
    allowUnknown: true,
    convert: true,
    stripUnknown: true,
  });
  if (result.error) {
    throw new Error(`Environment validation failed: ${result.error.message}`);
  }
  return result.value;
}

export function validateApiEnvironment(input: Record<string, unknown>): Record<string, unknown> {
  return validateWithSchema(apiEnvironmentSchema, input);
}

export function validateDatabaseEnvironment(
  input: Record<string, unknown>,
): Record<string, unknown> {
  return validateWithSchema(databaseOnlyEnvironmentSchema, input);
}

export function loadApiConfiguration(): AppConfiguration {
  const environment = validateApiEnvironment(process.env);
  return {
    app: createAppConfig(environment),
    auth: createAuthConfig(environment),
    cors: createCorsConfig(environment),
    logging: createLoggingConfig(environment),
    observability: createObservabilityConfig(environment),
    retention: createRetentionConfig(environment),
    swagger: createSwaggerConfig(environment),
    rateLimit: createRateLimitConfig(environment),
    i18n: createI18nConfig(environment),
    mail: createMailConfig(environment),
    ...createApiCapabilityConfiguration(environment),
    database: createDatabaseConfig(environment),
    redis: createRedisConfig(environment),
  };
}

export function loadDatabaseConfiguration(
  input: Record<string, unknown> = process.env,
): DatabaseConfig {
  return createDatabaseConfig(validateDatabaseEnvironment(input));
}

export function validateMailWorkerEnvironment(
  input: Record<string, unknown>,
): Record<string, unknown> {
  return validateWithSchema(mailWorkerEnvironmentSchema, input);
}

export function loadMailWorkerConfiguration(): MailWorkerConfiguration {
  const environment = validateMailWorkerEnvironment(process.env);
  return {
    app: createAppConfig(environment),
    logging: createLoggingConfig(environment),
    mail: createMailConfig(environment),
    database: createDatabaseConfig(environment),
    redis: createRedisConfig(environment),
  };
}
