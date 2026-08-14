import type { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type { NestExpressApplication } from '@nestjs/platform-express';

import { API_VERSION } from '@/common/http/api-version.constants';
import type { AppConfiguration } from '@/config/configuration.types';

import { createSwaggerBasicAuthMiddleware } from './swagger-basic-auth.middleware';

export function configureSwagger(
  app: NestExpressApplication,
  configService: ConfigService<AppConfiguration, true>,
): void {
  const swaggerAccess = configService.getOrThrow('swagger.access', { infer: true });
  if (swaggerAccess === 'disabled') {
    return;
  }

  if (swaggerAccess === 'basic') {
    const basicAuth = createSwaggerBasicAuthMiddleware(
      configService.getOrThrow('swagger.username', { infer: true }),
      configService.getOrThrow('swagger.password', { infer: true }),
    );
    app.use('/docs', basicAuth);
    app.use('/docs-json', basicAuth);
    app.use('/docs-yaml', basicAuth);
  }

  const appName = configService.getOrThrow('app.name', { infer: true });
  const swaggerConfig = new DocumentBuilder()
    .setTitle(appName)
    .setDescription('Single-tenant SaaS platform API')
    .setVersion(API_VERSION)
    .addBearerAuth()
    .build();
  SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, swaggerConfig), {
    customSiteTitle: `${appName} Documentation`,
  });
}
