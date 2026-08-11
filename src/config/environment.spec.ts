import { parseCorsOrigins, validateEnvironment } from './environment';

const validEnvironment = {
  DATABASE_HOST: 'localhost',
  DATABASE_NAME: 'app',
  DATABASE_PASSWORD: 'local-password',
  DATABASE_USERNAME: 'app',
  REDIS_HOST: 'localhost',
};

describe('environment validation', () => {
  it('applies safe development defaults', () => {
    const result = validateEnvironment({ ...validEnvironment, PATH: '/usr/local/bin' });

    expect(result.NODE_ENV).toBe('development');
    expect(result.APP_NAME).toBe('NestJS SaaS API');
    expect(result.PORT).toBe(3000);
    expect(result.SWAGGER_DOCS_ACCESS).toBe('disabled');
    expect(result.DATABASE_SSL_ENABLED).toBe(false);
    expect(result.REDIS_DB).toBe(0);
    expect(result).not.toHaveProperty('PATH');
  });

  it('rejects public Swagger access in managed environments', () => {
    expect(() =>
      validateEnvironment({
        ...validEnvironment,
        NODE_ENV: 'staging',
        REDIS_PASSWORD: 'a-secure-redis-password',
        SWAGGER_DOCS_ACCESS: 'public',
      }),
    ).toThrow('SWAGGER_DOCS_ACCESS cannot be public');
  });

  it('requires strong credentials for basic Swagger access', () => {
    expect(() =>
      validateEnvironment({
        ...validEnvironment,
        SWAGGER_DOCS_ACCESS: 'basic',
        SWAGGER_DOCS_USERNAME: 'ab',
        SWAGGER_DOCS_PASSWORD: 'weak',
      }),
    ).toThrow('SWAGGER_DOCS_USERNAME must contain at least 3 characters');

    expect(
      validateEnvironment({
        ...validEnvironment,
        SWAGGER_DOCS_ACCESS: 'basic',
        SWAGGER_DOCS_USERNAME: 'docs-user',
        SWAGGER_DOCS_PASSWORD: 'strong-docs-password',
      }).SWAGGER_DOCS_ACCESS,
    ).toBe('basic');
  });

  it('rejects unused Swagger credentials', () => {
    expect(() =>
      validateEnvironment({
        ...validEnvironment,
        SWAGGER_DOCS_ACCESS: 'disabled',
        SWAGGER_DOCS_USERNAME: 'docs-user',
      }),
    ).toThrow('must be empty unless SWAGGER_DOCS_ACCESS is basic');
  });

  it('requires a strong Redis password in managed environments', () => {
    expect(() =>
      validateEnvironment({
        ...validEnvironment,
        NODE_ENV: 'staging',
        REDIS_PASSWORD: 'weak',
      }),
    ).toThrow('REDIS_PASSWORD must contain at least 16 characters');
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
      expect(() => validateEnvironment({ ...validEnvironment, CORS_ORIGINS: corsOrigins })).toThrow(
        'CORS_ORIGINS must be a comma-separated list of exact HTTP(S) origins',
      );
    },
  );
});
