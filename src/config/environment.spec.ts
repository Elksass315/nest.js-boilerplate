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
    expect(result.APP_PORT).toBe(3000);
    expect(result.DATABASE_SSL_ENABLED).toBe(false);
    expect(result.REDIS_DB).toBe(0);
    expect(result).not.toHaveProperty('PATH');
  });

  it('rejects Swagger in production', () => {
    expect(() =>
      validateEnvironment({
        ...validEnvironment,
        NODE_ENV: 'production',
        REDIS_PASSWORD: 'a-secure-redis-password',
        SWAGGER_ENABLED: true,
      }),
    ).toThrow('SWAGGER_ENABLED must be false in production');
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
});
