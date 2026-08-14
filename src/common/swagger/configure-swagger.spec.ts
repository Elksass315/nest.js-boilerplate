import type { ConfigService } from '@nestjs/config';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { SwaggerModule } from '@nestjs/swagger';

import type { AppConfiguration, SwaggerDocsAccess } from '@/config/configuration.types';

import { configureSwagger } from './configure-swagger';

function createApp(): NestExpressApplication {
  return { use: jest.fn() } as unknown as NestExpressApplication;
}

function createConfigService(access: SwaggerDocsAccess): ConfigService<AppConfiguration, true> {
  const values = {
    'app.name': 'Example API',
    'swagger.access': access,
    'swagger.password': access === 'basic' ? 'strong-docs-password' : '',
    'swagger.username': access === 'basic' ? 'docs-user' : '',
  };
  return {
    getOrThrow: jest.fn((key: keyof typeof values) => values[key]),
  } as unknown as ConfigService<AppConfiguration, true>;
}

describe(configureSwagger.name, () => {
  beforeEach(() => {
    jest.spyOn(SwaggerModule, 'createDocument').mockReturnValue({ openapi: '3.0.0' } as never);
    jest.spyOn(SwaggerModule, 'setup').mockImplementation();
  });
  afterEach(() => jest.restoreAllMocks());

  it('registers public documentation without middleware', () => {
    const app = createApp();
    configureSwagger(app, createConfigService('public'));
    expect(app.use).not.toHaveBeenCalled();
    expect(SwaggerModule.setup).toHaveBeenCalledWith('docs', app, expect.any(Object), {
      customSiteTitle: 'Example API Documentation',
    });
  });

  it('protects every documentation endpoint in basic mode', () => {
    const app = createApp();
    configureSwagger(app, createConfigService('basic'));
    expect(app.use).toHaveBeenCalledTimes(3);
  });

  it('does not register disabled documentation', () => {
    const app = createApp();
    configureSwagger(app, createConfigService('disabled'));
    expect(SwaggerModule.createDocument).not.toHaveBeenCalled();
  });
});
