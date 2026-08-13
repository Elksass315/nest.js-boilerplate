import { parseCorsOrigins } from './cors.config';
import {
  loadApiConfiguration,
  validateApiEnvironment,
  validateDatabaseEnvironment,
  validateMailWorkerEnvironment,
} from './environment';

const validEnvironment = {
  AUTH_ACCESS_TOKEN_SECRET: 'test-only-access-token-secret-at-least-32-characters',
  DATABASE_HOST: 'localhost',
  DATABASE_NAME: 'app',
  DATABASE_PASSWORD: 'local-password',
  DATABASE_USERNAME: 'app',
  REDIS_HOST: 'localhost',
};

describe('environment validation', () => {
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
        REDIS_PASSWORD: 'a-secure-redis-password',
        SWAGGER_DOCS_ACCESS: 'public',
      }),
    ).toThrow('SWAGGER_DOCS_ACCESS cannot be public');
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
