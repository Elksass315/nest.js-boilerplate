import type { ConfigService } from '@nestjs/config';
import { SwaggerModule } from '@nestjs/swagger';
import type { NestExpressApplication } from '@nestjs/platform-express';

import type { EnvironmentVariables } from '@/config/environment';

import { configureSwagger } from './configure-swagger';

function createApp(): NestExpressApplication {
  return { use: jest.fn() } as unknown as NestExpressApplication;
}

function createConfigService(
  access: EnvironmentVariables['SWAGGER_DOCS_ACCESS'],
): ConfigService<EnvironmentVariables, true> {
  const values = {
    APP_NAME: 'Example API',
    SWAGGER_DOCS_ACCESS: access,
    SWAGGER_DOCS_PASSWORD: access === 'basic' ? 'strong-docs-password' : '',
    SWAGGER_DOCS_USERNAME: access === 'basic' ? 'docs-user' : '',
  };

  return {
    getOrThrow: jest.fn((key: keyof typeof values) => values[key]),
  } as unknown as ConfigService<EnvironmentVariables, true>;
}

describe(configureSwagger.name, () => {
  beforeEach(() => {
    jest.spyOn(SwaggerModule, 'createDocument').mockReturnValue({ openapi: '3.0.0' } as never);
    jest.spyOn(SwaggerModule, 'setup').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('registers public documentation without middleware', () => {
    const app = createApp();

    configureSwagger(app, createConfigService('public'));

    expect(app.use).not.toHaveBeenCalled();
    expect(SwaggerModule.setup).toHaveBeenCalledWith('docs', app, expect.any(Object), {
      customSiteTitle: 'Example API Documentation',
    });
  });

  it('protects the UI, JSON, and YAML endpoints in basic mode', () => {
    const app = createApp();

    configureSwagger(app, createConfigService('basic'));

    expect(app.use).toHaveBeenCalledTimes(3);
    expect(app.use).toHaveBeenNthCalledWith(1, '/docs', expect.any(Function));
    expect(app.use).toHaveBeenNthCalledWith(2, '/docs-json', expect.any(Function));
    expect(app.use).toHaveBeenNthCalledWith(3, '/docs-yaml', expect.any(Function));
    expect(SwaggerModule.setup).toHaveBeenCalledTimes(1);
  });

  it('does not register documentation in disabled mode', () => {
    const app = createApp();

    configureSwagger(app, createConfigService('disabled'));

    expect(app.use).not.toHaveBeenCalled();
    expect(SwaggerModule.createDocument).not.toHaveBeenCalled();
    expect(SwaggerModule.setup).not.toHaveBeenCalled();
  });
});
