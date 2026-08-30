import Joi from 'joi';

import { appEnvironmentSchema, createAppConfig } from '@/config/app.config';
import type { AppConfig, FilesConfig, LoggingConfig } from '@/config/configuration.types';
import {
  createFilesConfig,
  filesEnvironmentSchema,
  parseFileStorageDrivers,
} from '@/config/files.config';
import { createLoggingConfig, loggingEnvironmentSchema } from '@/config/logging.config';
import {
  createDatabaseConfig,
  databaseEnvironmentSchema,
  type DatabaseConfig,
} from '@/database/config/database.config';
import {
  createRedisConfig,
  redisEnvironmentSchema,
  type RedisConfig,
} from '@/redis/config/redis.config';

export interface FileWorkerConfiguration {
  app: AppConfig;
  logging: LoggingConfig;
  files: FilesConfig;
  database: DatabaseConfig;
  redis: RedisConfig;
}

const schema = Joi.object<Record<string, unknown>>({
  ...appEnvironmentSchema,
  ...loggingEnvironmentSchema,
  ...filesEnvironmentSchema,
  ...databaseEnvironmentSchema,
  ...redisEnvironmentSchema,
})
  .custom(validateContradictions)
  .messages({
    'environment.filesDrivers':
      'FILES_READ_DRIVERS must include FILES_WRITE_DRIVER and S3 settings must be complete when s3 is enabled',
    'environment.productionFiles': 'Production file writes require the S3 storage driver',
    'environment.redisPassword':
      'REDIS_PASSWORD must contain at least 16 characters in staging and production',
  });

export function validateFileWorkerEnvironment(
  input: Record<string, unknown>,
): Record<string, unknown> {
  const result = schema.validate(input, {
    abortEarly: false,
    allowUnknown: true,
    convert: true,
    stripUnknown: true,
  });
  if (result.error) throw new Error(`Environment validation failed: ${result.error.message}`);
  return result.value;
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

function validateContradictions(
  environment: Record<string, unknown>,
  helpers: Joi.CustomHelpers,
): Record<string, unknown> | Joi.ErrorReport {
  if (environment['NODE_ENV'] === 'production' && environment['FILES_WRITE_DRIVER'] !== 's3') {
    return helpers.error('environment.productionFiles');
  }
  const redisPassword = environment['REDIS_PASSWORD'];
  if (
    (environment['NODE_ENV'] === 'staging' || environment['NODE_ENV'] === 'production') &&
    (typeof redisPassword !== 'string' || redisPassword.length < 16)
  ) {
    return helpers.error('environment.redisPassword');
  }
  return filesConfigurationAgrees(environment)
    ? environment
    : helpers.error('environment.filesDrivers');
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
  return (
    typeof bucket === 'string' &&
    bucket.length > 0 &&
    (typeof accessKey === 'string' && accessKey.length > 0) ===
      (typeof secretKey === 'string' && secretKey.length > 0)
  );
}
