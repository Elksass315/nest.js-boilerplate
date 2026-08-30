import { parseCorsOrigins } from './cors.config';
import {
  loadApiConfiguration,
  validateApiEnvironment,
  validateDatabaseEnvironment,
  validateMailWorkerEnvironment,
} from './environment';
import { validateFileWorkerEnvironment } from './file-worker.environment';

const validEnvironment = {
  AUTH_ACCESS_TOKEN_SECRET: 'test-only-access-token-secret-at-least-32-characters',
  DATABASE_HOST: 'localhost',
  DATABASE_NAME: 'app',
  DATABASE_PASSWORD: 'local-password',
  DATABASE_USERNAME: 'app',
  REDIS_HOST: 'localhost',
};

describe('environment validation', () => {
  it('requires an OTLP endpoint when telemetry is enabled', () => {
    expect(() =>
      validateApiEnvironment({
        ...validEnvironment,
        OTEL_ENABLED: true,
        OTEL_EXPORTER_OTLP_ENDPOINT: '',
      }),
    ).toThrow('OTEL_EXPORTER_OTLP_ENDPOINT');
  });

  it('loads namespaced development defaults', () => {
    const original = process.env;
    process.env = { ...original, ...validEnvironment };
    try {
      const result = loadApiConfiguration();
      expect(result.app).toEqual(expect.objectContaining({ nodeEnv: 'test', port: 3000 }));
      expect(result.swagger.access).toBe('disabled');
      expect(result.i18n).toEqual(
        expect.objectContaining({ fallbackLanguage: 'en', supportedLanguages: ['en'] }),
      );
      expect(result.database.sslEnabled).toBe(false);
      expect(result.redis.db).toBe(0);
      expect(result.files.userAvatar).toEqual(
        expect.objectContaining({ maxBytes: 5_242_880, maxPixels: 25_000_000 }),
      );
      expect(result.invitations).toEqual(
        expect.objectContaining({ ttlHours: 72, maxSends: 5, resendCooldownSeconds: 60 }),
      );
      expect(result.sentry).toEqual(
        expect.objectContaining({ enabled: false, environment: 'test', tracesSampleRate: 0 }),
      );
    } finally {
      process.env = original;
    }
  });

  it('validates database configuration without API or Redis values', () => {
    expect(validateDatabaseEnvironment(validEnvironment)).toEqual(
      expect.objectContaining({ DATABASE_HOST: 'localhost', DATABASE_PORT: 5432 }),
    );
  });

  it('validates the mail worker without API, CORS, Swagger, or auth settings', () => {
    const worker = validateMailWorkerEnvironment({
      DATABASE_HOST: 'localhost',
      DATABASE_NAME: 'mail_worker_test',
      DATABASE_PASSWORD: 'local-password',
      DATABASE_USERNAME: 'app',
      REDIS_HOST: 'localhost',
      MAIL_ENABLED: true,
      MAIL_SMTP_HOST: 'mailpit',
    });

    expect(worker).toEqual(
      expect.objectContaining({
        MAIL_ENABLED: true,
        MAIL_WORKER_CONCURRENCY: 5,
        MAIL_SMTP_CONNECTION_TIMEOUT_MS: 10000,
      }),
    );
    expect(worker).not.toHaveProperty('AUTH_ACCESS_TOKEN_SECRET');
  });

  it('validates the file worker without API, CORS, Swagger, auth, or mail settings', () => {
    const worker = validateFileWorkerEnvironment({
      DATABASE_HOST: 'localhost',
      DATABASE_NAME: 'file_worker_test',
      DATABASE_PASSWORD: 'local-password',
      DATABASE_USERNAME: 'app',
      REDIS_HOST: 'localhost',
      FILES_WRITE_DRIVER: 'local',
      FILES_READ_DRIVERS: 'local',
    });

    expect(worker).toEqual(
      expect.objectContaining({
        FILES_WRITE_DRIVER: 'local',
        FILES_WORKER_CONCURRENCY: 5,
        FILES_USER_AVATAR_MAX_BYTES: 5_242_880,
      }),
    );
    expect(worker).not.toHaveProperty('AUTH_ACCESS_TOKEN_SECRET');
    expect(worker).not.toHaveProperty('MAIL_SMTP_HOST');
  });

  it('rejects incomplete S3 file storage configuration', () => {
    expect(() =>
      validateFileWorkerEnvironment({
        ...validEnvironment,
        FILES_WRITE_DRIVER: 's3',
        FILES_READ_DRIVERS: 'local,s3',
        FILES_S3_BUCKET: '',
      }),
    ).toThrow('FILES_READ_DRIVERS must include FILES_WRITE_DRIVER');
  });

  it('rejects contradictory Sentry settings in the API profile', () => {
    const invalid = { ...validEnvironment, SENTRY_ENABLED: true, SENTRY_DSN: '' };
    expect(() => validateApiEnvironment(invalid)).toThrow('SENTRY_DSN must be set exactly');
  });

  it('rejects a relative local file storage root', () => {
    expect(() =>
      validateFileWorkerEnvironment({
        ...validEnvironment,
        FILES_LOCAL_ROOT: 'storage/files',
      }),
    ).toThrow('FILES_LOCAL_ROOT must be absolute');
  });

  it('rejects incomplete SMTP credentials in API and worker profiles', () => {
    expect(() =>
      validateApiEnvironment({
        ...validEnvironment,
        MAIL_SMTP_USERNAME: 'smtp-user',
        MAIL_SMTP_PASSWORD: '',
      }),
    ).toThrow('MAIL_SMTP_USERNAME and MAIL_SMTP_PASSWORD must either both be set');
    expect(() =>
      validateMailWorkerEnvironment({
        ...validEnvironment,
        MAIL_SMTP_USERNAME: '',
        MAIL_SMTP_PASSWORD: 'smtp-password',
      }),
    ).toThrow('MAIL_SMTP_USERNAME and MAIL_SMTP_PASSWORD must either both be set');
  });

  it('rejects public Swagger access in managed environments', () => {
    expect(() =>
      validateApiEnvironment({
        ...validEnvironment,
        NODE_ENV: 'staging',
        AUTH_ACCESS_TOKEN_SECRET: 'managed-access-token-secret-123456789',
        DATABASE_PASSWORD: 'managed-database-password-123',
        REDIS_PASSWORD: 'a-secure-redis-password',
        SWAGGER_DOCS_ACCESS: 'public',
        APP_BASE_URL: 'https://api.client.org',
        MAIL_ACTION_BASE_URL: 'https://app.client.org/actions',
        TEAM_INVITATION_BASE_URL: 'https://app.client.org/invitations',
        CORS_ORIGINS: 'https://app.client.org',
        MAIL_FROM_ADDRESS: 'noreply@client.org',
        MAIL_BRANDING_SUPPORT_EMAIL: 'support@client.org',
      }),
    ).toThrow('SWAGGER_DOCS_ACCESS cannot be public');
  });

  it('rejects template secrets and insecure managed settings', () => {
    expect(() =>
      validateApiEnvironment({
        ...validEnvironment,
        NODE_ENV: 'production',
        AUTH_ACCESS_TOKEN_SECRET: 'local-only-change-this-access-token-secret',
        DATABASE_PASSWORD: 'strong-database-password',
        REDIS_PASSWORD: 'strong-redis-password',
        DATABASE_SSL_ENABLED: true,
        DATABASE_REJECT_UNAUTHORIZED: true,
        MAIL_SMTP_REQUIRE_TLS: true,
        APP_BASE_URL: 'https://api.example.test',
      }),
    ).toThrow('Managed environments cannot use template or synthetic secrets');
  });

  it('requires secure managed URLs, database SSL, and SMTP TLS', () => {
    const managed = {
      ...validEnvironment,
      NODE_ENV: 'staging',
      AUTH_ACCESS_TOKEN_SECRET: 'managed-access-token-secret-123456789',
      DATABASE_PASSWORD: 'managed-database-password-123',
      REDIS_PASSWORD: 'managed-redis-password-123',
      APP_BASE_URL: 'http://localhost:3000',
      MAIL_ACTION_BASE_URL: 'http://localhost:3000/actions',
      TEAM_INVITATION_BASE_URL: 'http://localhost:3000/invitations',
      CORS_ORIGINS: 'http://localhost:3000',
      MAIL_FROM_ADDRESS: 'noreply@client.org',
      MAIL_BRANDING_SUPPORT_EMAIL: 'support@client.org',
    };
    expect(() => validateApiEnvironment(managed)).toThrow('Managed public URLs');
    expect(() =>
      validateApiEnvironment({
        ...managed,
        APP_BASE_URL: 'https://api.client.org',
        MAIL_ACTION_BASE_URL: 'https://app.client.org/actions',
        TEAM_INVITATION_BASE_URL: 'https://app.client.org/invitations',
        CORS_ORIGINS: 'https://app.client.org',
        MAIL_FROM_ADDRESS: 'noreply@client.org',
        MAIL_BRANDING_SUPPORT_EMAIL: 'support@client.org',
      }),
    ).toThrow('Managed database connections');
    expect(() =>
      validateApiEnvironment({
        ...managed,
        APP_BASE_URL: 'https://api.client.org',
        MAIL_ACTION_BASE_URL: 'https://app.client.org/actions',
        TEAM_INVITATION_BASE_URL: 'https://app.client.org/invitations',
        CORS_ORIGINS: 'https://app.client.org',
        MAIL_FROM_ADDRESS: 'noreply@client.org',
        MAIL_BRANDING_SUPPORT_EMAIL: 'support@client.org',
        DATABASE_SSL_ENABLED: true,
        DATABASE_REJECT_UNAUTHORIZED: true,
      }),
    ).toThrow('MAIL_SMTP_REQUIRE_TLS');
  });

  it('requires S3 writes in production', () => {
    expect(() =>
      validateFileWorkerEnvironment({
        ...validEnvironment,
        NODE_ENV: 'production',
        AUTH_ACCESS_TOKEN_SECRET: 'managed-access-token-secret-123456789',
        DATABASE_PASSWORD: 'managed-database-password-123',
        DATABASE_SSL_ENABLED: true,
        DATABASE_REJECT_UNAUTHORIZED: true,
        REDIS_PASSWORD: 'managed-redis-password-123',
        APP_BASE_URL: 'https://api.client.org',
        FILES_WRITE_DRIVER: 'local',
        FILES_READ_DRIVERS: 'local',
      }),
    ).toThrow('Production file writes require the S3 storage driver');
  });

  it('requires an explicit trusted proxy allowlist in managed API environments', () => {
    expect(() =>
      validateApiEnvironment({
        ...validEnvironment,
        NODE_ENV: 'staging',
        AUTH_ACCESS_TOKEN_SECRET: 'managed-access-token-secret-123456789',
        DATABASE_PASSWORD: 'managed-database-password-123',
        REDIS_PASSWORD: 'managed-redis-password-123',
        DATABASE_SSL_ENABLED: true,
        DATABASE_REJECT_UNAUTHORIZED: true,
        MAIL_SMTP_REQUIRE_TLS: true,
        APP_BASE_URL: 'https://api.client.org',
        MAIL_ACTION_BASE_URL: 'https://app.client.org/actions',
        TEAM_INVITATION_BASE_URL: 'https://app.client.org/invitations',
        CORS_ORIGINS: 'https://app.client.org',
        MAIL_FROM_ADDRESS: 'noreply@client.org',
        MAIL_BRANDING_SUPPORT_EMAIL: 'support@client.org',
      }),
    ).toThrow('TRUSTED_PROXY_IPS must contain an explicit proxy allowlist');
  });

  it('requires strong credentials for basic Swagger access', () => {
    expect(() =>
      validateApiEnvironment({
        ...validEnvironment,
        SWAGGER_DOCS_ACCESS: 'basic',
        SWAGGER_DOCS_USERNAME: 'ab',
        SWAGGER_DOCS_PASSWORD: 'weak',
      }),
    ).toThrow('SWAGGER_DOCS_USERNAME must contain at least 3 characters');

    expect(() =>
      validateApiEnvironment({
        ...validEnvironment,
        SWAGGER_DOCS_ACCESS: 'basic',
        SWAGGER_DOCS_USERNAME: 'admin',
        SWAGGER_DOCS_PASSWORD: 'short-password',
      }),
    ).toThrow('SWAGGER_DOCS_PASSWORD at least 16 characters');
  });

  it('rejects Swagger credentials unless basic access is enabled', () => {
    expect(() =>
      validateApiEnvironment({
        ...validEnvironment,
        SWAGGER_DOCS_ACCESS: 'public',
        SWAGGER_DOCS_USERNAME: 'admin',
        SWAGGER_DOCS_PASSWORD: 'strong-docs-password',
      }),
    ).toThrow('SWAGGER_DOCS_USERNAME and SWAGGER_DOCS_PASSWORD must be empty');
  });

  it('requires the fallback language to be supported', () => {
    expect(() =>
      validateApiEnvironment({
        ...validEnvironment,
        APP_FALLBACK_LANGUAGE: 'ar',
        APP_SUPPORTED_LANGUAGES: 'en',
      }),
    ).toThrow('APP_FALLBACK_LANGUAGE must be included');
  });

  it('normalizes a comma-separated CORS allowlist', () => {
    expect(parseCorsOrigins('https://one.test, https://two.test,')).toEqual([
      'https://one.test',
      'https://two.test',
    ]);
  });

  it.each(['*', 'https://example.test/path', 'file:///tmp/app', 'not-a-url'])(
    'rejects an unsafe CORS origin: %s',
    (corsOrigins) => {
      expect(() =>
        validateApiEnvironment({ ...validEnvironment, CORS_ORIGINS: corsOrigins }),
      ).toThrow('CORS_ORIGINS must be a comma-separated list of exact HTTP(S) origins');
    },
  );
});
