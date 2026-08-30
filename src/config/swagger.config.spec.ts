import { createSwaggerConfig } from './swagger.config';

describe('Swagger configuration', () => {
  it('maps disabled documentation settings without credentials', () => {
    expect(
      createSwaggerConfig({
        SWAGGER_DOCS_ACCESS: 'disabled',
        SWAGGER_DOCS_USERNAME: '',
        SWAGGER_DOCS_PASSWORD: '',
      }),
    ).toEqual({ access: 'disabled', username: '', password: '' });
  });

  it('maps basic authentication settings', () => {
    expect(
      createSwaggerConfig({
        SWAGGER_DOCS_ACCESS: 'basic',
        SWAGGER_DOCS_USERNAME: 'admin',
        SWAGGER_DOCS_PASSWORD: 'strong-docs-password',
      }),
    ).toEqual({ access: 'basic', username: 'admin', password: 'strong-docs-password' });
  });
});
