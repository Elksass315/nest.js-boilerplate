import type Joi from 'joi';

import { createFilesConfig, filesEnvironmentSchema, parseFileStorageDrivers } from './files.config';
import { createInvitationsConfig, invitationsEnvironmentSchema } from './invitations.config';
import {
  createSentryConfig,
  sentryConfigurationAgrees,
  sentryEnvironmentSchema,
} from './sentry.config';
import type { FilesConfig, InvitationsConfig, SentryConfig } from './configuration.types';

export interface CapabilityConfiguration {
  files: FilesConfig;
  invitations: InvitationsConfig;
  sentry: SentryConfig;
}

export const capabilityApiEnvironmentSchema = {
  ...filesEnvironmentSchema,
  ...invitationsEnvironmentSchema,
  ...sentryEnvironmentSchema,
} satisfies Record<string, Joi.Schema>;

export const capabilityEnvironmentMessages = {
  'environment.filesDrivers':
    'FILES_READ_DRIVERS must include FILES_WRITE_DRIVER and S3 settings must be complete when s3 is enabled',
  'environment.productionFiles': 'Production file writes require the S3 storage driver',
  'environment.sentryDsn': 'SENTRY_DSN must be set exactly when SENTRY_ENABLED is true',
  'environment.managedSecrets': 'Managed environments cannot use local or test storage credentials',
  'environment.managedUrls': 'Managed capability URLs must use a public HTTPS origin',
};

export function validateApiCapabilityContradictions(
  environment: Record<string, unknown>,
  helpers: Joi.CustomHelpers,
): Joi.ErrorReport | undefined {
  if (environment['NODE_ENV'] === 'production' && environment['FILES_WRITE_DRIVER'] !== 's3') {
    return helpers.error('environment.productionFiles');
  }
  if (!filesConfigurationAgrees(environment)) {
    return helpers.error('environment.filesDrivers');
  }
  if (!sentryConfigurationAgrees(environment)) {
    return helpers.error('environment.sentryDsn');
  }
  const isManaged =
    environment['NODE_ENV'] === 'staging' || environment['NODE_ENV'] === 'production';
  if (isManaged && filesSecretsAreUnsafe(environment)) {
    return helpers.error('environment.managedSecrets');
  }
  if (isManaged && !capabilityUrlsAreSafe(environment)) {
    return helpers.error('environment.managedUrls');
  }
  return undefined;
}

function filesSecretsAreUnsafe(environment: Record<string, unknown>): boolean {
  return ['FILES_S3_ACCESS_KEY_ID', 'FILES_S3_SECRET_ACCESS_KEY'].some((key) => {
    const value = environment[key];
    return typeof value === 'string' && ['test', 'localstack'].includes(value);
  });
}

function capabilityUrlsAreSafe(environment: Record<string, unknown>): boolean {
  for (const key of ['TEAM_INVITATION_BASE_URL', 'FILES_S3_CDN_URL']) {
    const value = environment[key];
    if (typeof value === 'string' && value.length > 0 && !isManagedUrl(value)) return false;
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
  return true;
}

function isManagedUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (
      url.protocol === 'https:' &&
      !['localhost', '127.0.0.1', '::1'].includes(url.hostname) &&
      !/example\.(?:com|test)$/iu.test(url.hostname)
    );
  } catch {
    return false;
  }
}

export function createApiCapabilityConfiguration(
  environment: Record<string, unknown>,
): CapabilityConfiguration {
  return {
    files: createFilesConfig(environment),
    invitations: createInvitationsConfig(environment),
    sentry: createSentryConfig(environment),
  };
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
