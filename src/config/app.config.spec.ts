import { createAppConfig } from './app.config';

describe('app configuration', () => {
  it('maps validated environment values', () => {
    expect(
      createAppConfig({ NODE_ENV: 'test', APP_NAME: 'Test API', PORT: 3100, API_PREFIX: 'api-v2' }),
    ).toEqual({ nodeEnv: 'test', name: 'Test API', port: 3100, apiPrefix: 'api-v2' });
  });
});
