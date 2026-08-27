import Joi from 'joi';

import {
  createDatabaseConfig,
  databaseEnvironmentSchema,
  type DatabaseConfig,
} from '@/database/config/database.config';
import { createRedisConfig, redisEnvironmentSchema } from '@/redis/config/redis.config';

import { appEnvironmentSchema, createAppConfig } from './app.config';
import { authEnvironmentSchema, createAuthConfig } from './auth.config';
import type {
  AppConfiguration,
  FileWorkerConfiguration,
  MailWorkerConfiguration,
} from './configuration.types';
import { corsEnvironmentSchema, createCorsConfig, parseCorsOrigins } from './cors.config';
import { createI18nConfig, i18nEnvironmentSchema, parseSupportedLanguages } from './i18n.config';
import { createLoggingConfig, loggingEnvironmentSchema } from './logging.config';
import { createInvitationsConfig, invitationsEnvironmentSchema } from './invitations.config';
import { createMailConfig, mailEnvironmentSchema } from './mail.config';
import { createFilesConfig, filesEnvironmentSchema, parseFileStorageDrivers } from './files.config';
import { createRateLimitConfig, rateLimitEnvironmentSchema } from './rate-limit.config';
import { createSwaggerConfig, swaggerEnvironmentSchema } from './swagger.config';
import {
  createSentryConfig,
  sentryConfigurationAgrees,
  sentryEnvironmentSchema,
} from './sentry.config';

const apiEnvironmentSchema = Joi.object<Record<string, unknown>>({
  ...appEnvironmentSchema,
  ...authEnvironmentSchema,
  ...corsEnvironmentSchema,
  ...loggingEnvironmentSchema,
  ...sentryEnvironmentSchema,
  ...swaggerEnvironmentSchema,
  ...rateLimitEnvironmentSchema,
  ...i18nEnvironmentSchema,
  ...mailEnvironmentSchema,
  ...invitationsEnvironmentSchema,
  ...filesEnvironmentSchema,
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
    'environment.filesDrivers':
      'FILES_READ_DRIVERS must include FILES_WRITE_DRIVER and S3 settings must be complete when s3 is enabled',
    'environment.sentryDsn': 'SENTRY_DSN must be set exactly when SENTRY_ENABLED is true',
    'environment.managedSecrets': 'Managed environments cannot use template or synthetic secrets',
    'environment.managedUrls':
      'Managed public URLs and CORS origins must use HTTPS and cannot target localhost or example domains',
    'environment.databaseSecurity':
      'Managed database connections require SSL certificate verification and a password of at least 16 characters',
    'environment.smtpTls': 'MAIL_SMTP_REQUIRE_TLS must be true in staging and production',
    'environment.productionFiles': 'Production file writes require the S3 storage driver',
  });

const databaseOnlyEnvironmentSchema = Joi.object<Record<string, unknown>>({
  ...databaseEnvironmentSchema,
});

const mailWorkerEnvironmentSchema = Joi.object<Record<string, unknown>>({
  ...appEnvironmentSchema,
  ...loggingEnvironmentSchema,
  ...sentryEnvironmentSchema,
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
    'environment.sentryDsn': 'SENTRY_DSN must be set exactly when SENTRY_ENABLED is true',
    'environment.managedSecrets': 'Managed environments cannot use template or synthetic secrets',
    'environment.managedUrls':
      'Managed public URLs must use HTTPS and cannot target localhost or example domains',
    'environment.databaseSecurity':
      'Managed database connections require SSL certificate verification and a password of at least 16 characters',
    'environment.smtpTls': 'MAIL_SMTP_REQUIRE_TLS must be true in staging and production',
  });

const fileWorkerEnvironmentSchema = Joi.object<Record<string, unknown>>({
  ...appEnvironmentSchema,
  ...loggingEnvironmentSchema,
  ...sentryEnvironmentSchema,
  ...filesEnvironmentSchema,
  ...databaseEnvironmentSchema,
  ...redisEnvironmentSchema,
})
  .custom(validateFileWorkerContradictions)
  .messages({
    'environment.redisPassword':
      'REDIS_PASSWORD must contain at least 16 characters in staging and production',
    'environment.filesDrivers':
      'FILES_READ_DRIVERS must include FILES_WRITE_DRIVER and S3 settings must be complete when s3 is enabled',
    'environment.sentryDsn': 'SENTRY_DSN must be set exactly when SENTRY_ENABLED is true',
    'environment.managedSecrets': 'Managed environments cannot use template or synthetic secrets',
    'environment.managedUrls':
      'Managed public URLs and S3 endpoints must use HTTPS and cannot target localhost or example domains',
    'environment.databaseSecurity':
      'Managed database connections require SSL certificate verification and a password of at least 16 characters',
    'environment.productionFiles': 'Production file writes require the S3 storage driver',
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
  if (nodeEnvironment === 'production' && environment['FILES_WRITE_DRIVER'] !== 's3') {
    return helpers.error('environment.productionFiles');
  }
  if (isManaged && (typeof redisPassword !== 'string' || redisPassword.length < 16)) {
    return helpers.error('environment.redisPassword');
  }
  if (!smtpCredentialsAgree(environment)) {
    return helpers.error('environment.smtpCredentials');
  }
  if (!filesConfigurationAgrees(environment)) {
    return helpers.error('environment.filesDrivers');
  }
  if (!sentryConfigurationAgrees(environment)) {
    return helpers.error('environment.sentryDsn');
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

function filesConfigurationAgrees(environment: Record<string, unknown>): boolean {
  const writeDriver = environment['FILES_WRITE_DRIVER'];
  const readValue = environment['FILES_READ_DRIVERS'];
  if (typeof writeDriver !== 'string' || typeof readValue !== 'string') return false;
  let readDrivers: string[];
  try {
    readDrivers = parseFileStorageDrivers(readValue);
  } catch {
    return false;
  }
  if (!readDrivers.includes(writeDriver)) return false;
  if (!readDrivers.includes('s3')) return true;
  const bucket = environment['FILES_S3_BUCKET'];
  const accessKey = environment['FILES_S3_ACCESS_KEY_ID'];
  const secretKey = environment['FILES_S3_SECRET_ACCESS_KEY'];
  const encryption = environment['FILES_S3_SERVER_SIDE_ENCRYPTION'];
  const kmsKey = environment['FILES_S3_KMS_KEY_ID'];
  const credentialsAgree =
    (typeof accessKey === 'string' && accessKey.length > 0) ===
    (typeof secretKey === 'string' && secretKey.length > 0);
  const kmsAgrees = encryption !== 'aws:kms' || (typeof kmsKey === 'string' && kmsKey.length > 0);
  return typeof bucket === 'string' && bucket.length > 0 && credentialsAgree && kmsAgrees;
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
  if (!sentryConfigurationAgrees(environment)) {
    return helpers.error('environment.sentryDsn');
  }
  return environment;
}

function validateFileWorkerContradictions(
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
  if (nodeEnvironment === 'production' && environment['FILES_WRITE_DRIVER'] !== 's3') {
    return helpers.error('environment.productionFiles');
  }
  if (
    (nodeEnvironment === 'staging' || nodeEnvironment === 'production') &&
    (typeof redisPassword !== 'string' || redisPassword.length < 16)
  ) {
    return helpers.error('environment.redisPassword');
  }
  if (!filesConfigurationAgrees(environment)) {
    return helpers.error('environment.filesDrivers');
  }
  if (!sentryConfigurationAgrees(environment)) {
    return helpers.error('environment.sentryDsn');
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
  const secretKeys = [
    'AUTH_ACCESS_TOKEN_SECRET',
    'DATABASE_PASSWORD',
    'REDIS_PASSWORD',
    'FILES_S3_ACCESS_KEY_ID',
    'FILES_S3_SECRET_ACCESS_KEY',
  ];
  return secretKeys.some((key) => {
    const value = environment[key];
    return (
      typeof value === 'string' &&
      (TEMPLATE_VALUES.has(value) || value.toLowerCase().includes('change-this'))
    );
  });
}

function managedUrlsAreSafe(environment: Record<string, unknown>): boolean {
  const urlKeys = [
    'APP_BASE_URL',
    'MAIL_ACTION_BASE_URL',
    'TEAM_INVITATION_BASE_URL',
    'FILES_S3_CDN_URL',
  ];
  for (const key of urlKeys) {
    const value = environment[key];
    if (typeof value !== 'string' || value.length === 0) continue;
    if (!isManagedUrl(value)) return false;
  }
  const drivers = environment['FILES_READ_DRIVERS'];
  if (
    typeof drivers === 'string' &&
    drivers
      .split(',')
      .map((item) => item.trim())
      .includes('s3')
  ) {
    const endpoint = environment['FILES_S3_ENDPOINT'];
    if (typeof endpoint !== 'string' || !isManagedUrl(endpoint)) return false;
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
    sentry: createSentryConfig(environment),
    swagger: createSwaggerConfig(environment),
    rateLimit: createRateLimitConfig(environment),
    i18n: createI18nConfig(environment),
    mail: createMailConfig(environment),
    invitations: createInvitationsConfig(environment),
    files: createFilesConfig(environment),
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
    sentry: createSentryConfig(environment),
    mail: createMailConfig(environment),
    database: createDatabaseConfig(environment),
    redis: createRedisConfig(environment),
  };
}

export function validateFileWorkerEnvironment(
  input: Record<string, unknown>,
): Record<string, unknown> {
  return validateWithSchema(fileWorkerEnvironmentSchema, input);
}

export function loadFileWorkerConfiguration(): FileWorkerConfiguration {
  const environment = validateFileWorkerEnvironment(process.env);
  return {
    app: createAppConfig(environment),
    logging: createLoggingConfig(environment),
    sentry: createSentryConfig(environment),
    files: createFilesConfig(environment),
    database: createDatabaseConfig(environment),
    redis: createRedisConfig(environment),
  };
}
