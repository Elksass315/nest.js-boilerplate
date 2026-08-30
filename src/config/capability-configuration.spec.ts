import Joi from 'joi';

import {
  capabilityApiEnvironmentSchema,
  capabilityEnvironmentMessages,
  createApiCapabilityConfiguration,
  validateApiCapabilityContradictions,
} from './capability-configuration';

const baseEnvironment = {
  NODE_ENV: 'development',
  FILES_WRITE_DRIVER: 'local',
  FILES_READ_DRIVERS: 'local',
  SENTRY_ENABLED: false,
  SENTRY_DSN: '',
};

function validate(
  environment: Record<string, unknown>,
): Joi.ValidationResult<Record<string, unknown>> {
  return Joi.object(capabilityApiEnvironmentSchema)
    .custom(validateApiCapabilityContradictions)
    .messages(capabilityEnvironmentMessages)
    .validate(environment, { abortEarly: false, allowUnknown: true });
}

describe('capability configuration composition', () => {
  it('accepts a valid local capability configuration and creates typed values', () => {
    expect(validate(baseEnvironment).error).toBeUndefined();
    const configuration = createApiCapabilityConfiguration({
      ...baseEnvironment,
      FILES_LOCAL_ROOT: '/tmp/files',
      FILES_UPLOAD_EXPIRATION_HOURS: 24,
      FILES_SIGNED_URL_TTL_SECONDS: 300,
      FILES_WORKER_CONCURRENCY: 5,
      FILES_MAX_RETRIES: 5,
      FILES_RETRY_DELAY_MS: 30_000,
      FILES_METADATA_RETENTION_DAYS: 7,
      FILES_USER_AVATAR_MAX_BYTES: 5_242_880,
      FILES_USER_AVATAR_MAX_WIDTH: 8192,
      FILES_USER_AVATAR_MAX_HEIGHT: 8192,
      FILES_USER_AVATAR_MAX_PIXELS: 25_000_000,
      FILES_S3_BUCKET: '',
      FILES_S3_REGION: 'us-east-1',
      FILES_S3_ENDPOINT: '',
      FILES_S3_CDN_URL: '',
      FILES_S3_ACCESS_KEY_ID: '',
      FILES_S3_SECRET_ACCESS_KEY: '',
      FILES_S3_SERVER_SIDE_ENCRYPTION: 'AES256',
      FILES_S3_KMS_KEY_ID: '',
      FILES_S3_FORCE_PATH_STYLE: false,
      TEAM_INVITATION_BASE_URL: 'http://localhost:3000/invitations/accept',
      TEAM_INVITATION_TTL_HOURS: 72,
      TEAM_INVITATION_MAX_SENDS: 5,
      TEAM_INVITATION_RESEND_COOLDOWN_SECONDS: 60,
      SENTRY_ENVIRONMENT: 'test',
      SENTRY_RELEASE: 'local',
      SENTRY_TRACES_SAMPLE_RATE: 0,
      SENTRY_DEBUG: false,
    });
    expect(configuration.files.readDrivers).toEqual(['local']);
    expect(configuration.sentry.enabled).toBe(false);
  });

  it.each([
    [{ ...baseEnvironment, NODE_ENV: 'production' }, 'environment.productionFiles'],
    [{ ...baseEnvironment, FILES_READ_DRIVERS: 'invalid' }, 'environment.filesDrivers'],
    [{ ...baseEnvironment, SENTRY_ENABLED: true }, 'environment.sentryDsn'],
    [
      { ...baseEnvironment, NODE_ENV: 'staging', FILES_S3_ACCESS_KEY_ID: 'test' },
      'environment.managedSecrets',
    ],
    [
      { ...baseEnvironment, NODE_ENV: 'staging', TEAM_INVITATION_BASE_URL: 'http://localhost' },
      'environment.managedUrls',
    ],
  ])('rejects contradictory environment values (%s)', (environment, code) => {
    const result = validate(environment);
    expect(result.error?.details.map((detail) => detail.type)).toContain(code);
  });

  it('accepts complete managed S3 configuration', () => {
    const result = validate({
      NODE_ENV: 'production',
      FILES_WRITE_DRIVER: 's3',
      FILES_READ_DRIVERS: 'local,s3',
      FILES_S3_BUCKET: 'bucket',
      FILES_S3_ACCESS_KEY_ID: 'access',
      FILES_S3_SECRET_ACCESS_KEY: 'secret',
      FILES_S3_ENDPOINT: 'https://storage.example.net',
      TEAM_INVITATION_BASE_URL: 'https://app.client.example.org/invitations/accept',
      SENTRY_ENABLED: true,
      SENTRY_DSN: 'https://public@example.net/1',
    });
    expect(result.error).toBeUndefined();
  });
});
