import path from 'node:path';

import Joi from 'joi';

import type { FilesConfig, FileStorageDriver } from './configuration.types';
import { readBoolean, readNumber, readString } from './environment-reader';

const DRIVER_VALUES = ['local', 's3'] as const;

export const filesEnvironmentSchema = {
  FILES_WRITE_DRIVER: Joi.string()
    .valid(...DRIVER_VALUES)
    .default('local'),
  FILES_READ_DRIVERS: Joi.string().trim().default('local'),
  FILES_LOCAL_ROOT: Joi.string()
    .trim()
    .min(1)
    .custom((value: string, helpers) =>
      path.isAbsolute(value)
        ? value
        : helpers.message({ custom: 'FILES_LOCAL_ROOT must be absolute' }),
    )
    .default('/app/storage/files'),
  FILES_UPLOAD_EXPIRATION_HOURS: Joi.number().integer().min(1).max(168).default(24),
  FILES_SIGNED_URL_TTL_SECONDS: Joi.number().integer().min(60).max(3600).default(300),
  FILES_WORKER_CONCURRENCY: Joi.number().integer().min(1).max(20).default(5),
  FILES_MAX_RETRIES: Joi.number().integer().min(1).max(10).default(5),
  FILES_RETRY_DELAY_MS: Joi.number().integer().min(1000).max(300000).default(30000),
  FILES_S3_BUCKET: Joi.string().allow('').max(255).default(''),
  FILES_S3_REGION: Joi.string().trim().min(1).max(100).default('us-east-1'),
  FILES_S3_ENDPOINT: Joi.string()
    .allow('')
    .uri({ scheme: ['http', 'https'] })
    .default(''),
  FILES_S3_FORCE_PATH_STYLE: Joi.boolean().default(false),
  FILES_S3_CDN_URL: Joi.string()
    .allow('')
    .uri({ scheme: ['http', 'https'] })
    .default(''),
  FILES_S3_ACCESS_KEY_ID: Joi.string().allow('').max(512).default(''),
  FILES_S3_SECRET_ACCESS_KEY: Joi.string().allow('').max(512).default(''),
  FILES_S3_SERVER_SIDE_ENCRYPTION: Joi.string().valid('AES256', 'aws:kms').default('AES256'),
  FILES_S3_KMS_KEY_ID: Joi.string().allow('').max(2048).default(''),
} satisfies Record<string, Joi.Schema>;

export function parseFileStorageDrivers(value: string): FileStorageDriver[] {
  const drivers = [...new Set(value.split(',').map((item) => item.trim()))];
  if (drivers.length === 0 || drivers.some((driver) => !isFileStorageDriver(driver))) {
    throw new Error('FILES_READ_DRIVERS must contain only local and s3');
  }
  return drivers.filter(isFileStorageDriver);
}

export function createFilesConfig(environment: Record<string, unknown>): FilesConfig {
  return {
    writeDriver: readString(environment, 'FILES_WRITE_DRIVER') as FileStorageDriver,
    readDrivers: parseFileStorageDrivers(readString(environment, 'FILES_READ_DRIVERS')),
    localRoot: path.resolve(readString(environment, 'FILES_LOCAL_ROOT')),
    uploadExpirationMs: readNumber(environment, 'FILES_UPLOAD_EXPIRATION_HOURS') * 60 * 60 * 1000,
    signedUrlTtlSeconds: readNumber(environment, 'FILES_SIGNED_URL_TTL_SECONDS'),
    workerConcurrency: readNumber(environment, 'FILES_WORKER_CONCURRENCY'),
    maxRetries: readNumber(environment, 'FILES_MAX_RETRIES'),
    retryDelayMs: readNumber(environment, 'FILES_RETRY_DELAY_MS'),
    s3: {
      bucket: readString(environment, 'FILES_S3_BUCKET'),
      region: readString(environment, 'FILES_S3_REGION'),
      endpoint: readString(environment, 'FILES_S3_ENDPOINT'),
      forcePathStyle: readBoolean(environment, 'FILES_S3_FORCE_PATH_STYLE'),
      cdnUrl: readString(environment, 'FILES_S3_CDN_URL'),
      accessKeyId: readString(environment, 'FILES_S3_ACCESS_KEY_ID'),
      secretAccessKey: readString(environment, 'FILES_S3_SECRET_ACCESS_KEY'),
      serverSideEncryption: readString(
        environment,
        'FILES_S3_SERVER_SIDE_ENCRYPTION',
      ) as FilesConfig['s3']['serverSideEncryption'],
      kmsKeyId: readString(environment, 'FILES_S3_KMS_KEY_ID'),
    },
  };
}

function isFileStorageDriver(value: string): value is FileStorageDriver {
  return DRIVER_VALUES.some((driver) => driver === value);
}
