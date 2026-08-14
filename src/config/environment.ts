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
import { corsEnvironmentSchema, createCorsConfig } from './cors.config';
import { createI18nConfig, i18nEnvironmentSchema, parseSupportedLanguages } from './i18n.config';
import { createLoggingConfig, loggingEnvironmentSchema } from './logging.config';
import { createMailConfig, mailEnvironmentSchema } from './mail.config';
import { createFilesConfig, filesEnvironmentSchema, parseFileStorageDrivers } from './files.config';
import { createRateLimitConfig, rateLimitEnvironmentSchema } from './rate-limit.config';
import { createSwaggerConfig, swaggerEnvironmentSchema } from './swagger.config';

const apiEnvironmentSchema = Joi.object<Record<string, unknown>>({
  ...appEnvironmentSchema,
  ...authEnvironmentSchema,
  ...corsEnvironmentSchema,
  ...loggingEnvironmentSchema,
  ...swaggerEnvironmentSchema,
  ...rateLimitEnvironmentSchema,
  ...i18nEnvironmentSchema,
  ...mailEnvironmentSchema,
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
  });

const fileWorkerEnvironmentSchema = Joi.object<Record<string, unknown>>({
  ...appEnvironmentSchema,
  ...loggingEnvironmentSchema,
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
  if (isManaged && (typeof redisPassword !== 'string' || redisPassword.length < 16)) {
    return helpers.error('environment.redisPassword');
  }
  if (!smtpCredentialsAgree(environment)) {
    return helpers.error('environment.smtpCredentials');
  }
  if (!filesConfigurationAgrees(environment)) {
    return helpers.error('environment.filesDrivers');
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

function validateFileWorkerContradictions(
  environment: Record<string, unknown>,
  helpers: Joi.CustomHelpers,
): Record<string, unknown> | Joi.ErrorReport {
  const nodeEnvironment = environment['NODE_ENV'];
  const redisPassword = environment['REDIS_PASSWORD'];
  if (
    (nodeEnvironment === 'staging' || nodeEnvironment === 'production') &&
    (typeof redisPassword !== 'string' || redisPassword.length < 16)
  ) {
    return helpers.error('environment.redisPassword');
  }
  if (!filesConfigurationAgrees(environment)) {
    return helpers.error('environment.filesDrivers');
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
    swagger: createSwaggerConfig(environment),
    rateLimit: createRateLimitConfig(environment),
    i18n: createI18nConfig(environment),
    mail: createMailConfig(environment),
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
    files: createFilesConfig(environment),
    database: createDatabaseConfig(environment),
    redis: createRedisConfig(environment),
  };
}
