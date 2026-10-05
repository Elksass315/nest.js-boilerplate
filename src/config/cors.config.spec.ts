import { createCorsConfig, parseCorsOrigins } from './cors.config';

describe('CORS configuration', () => {
  it('trims and removes empty origins', () => {
    expect(parseCorsOrigins(' https://one.test, ,https://two.test ')).toEqual([
      'https://one.test',
      'https://two.test',
    ]);
  });

  it('creates the origin allowlist', () => {
    expect(createCorsConfig({ CORS_ORIGINS: 'https://one.test,https://two.test' })).toEqual({
      origins: ['https://one.test', 'https://two.test'],
    });
  });

  it('accepts a single wildcard origin', () => {
    expect(createCorsConfig({ CORS_ORIGINS: '*' })).toEqual({ origins: ['*'] });
  });
});
