import type { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule, type OpenAPIObject } from '@nestjs/swagger';
import type { NestExpressApplication } from '@nestjs/platform-express';

import { API_VERSION } from '@/common/http/api-version.constants';
import type { AppConfiguration } from '@/config/configuration.types';
import { ERROR_DEFINITIONS } from '@/core/errors/error-definitions';

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
  const document = createOpenApiDocument(app, appName);
  SwaggerModule.setup('docs', app, document, {
    customSiteTitle: `${appName} Documentation`,
  });
}

export type CompanyOpenApiDocument = OpenAPIObject & {
  'x-stable-errors': Record<string, { statusCode: number; message: string }>;
};

export function createOpenApiDocument(
  app: NestExpressApplication,
  appName: string,
): CompanyOpenApiDocument {
  const swaggerConfig = new DocumentBuilder()
    .setTitle(appName)
    .setDescription('Single-tenant SaaS platform API')
    .setVersion(API_VERSION)
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig) as CompanyOpenApiDocument;
  wrapJsonSuccessResponses(document);
  document['x-stable-errors'] = Object.fromEntries(
    Object.entries(ERROR_DEFINITIONS).map(([code, definition]) => [
      code,
      { statusCode: definition.status, message: definition.fallbackMessage },
    ]),
  );
  return document;
}

function wrapJsonSuccessResponses(document: OpenAPIObject): void {
  for (const pathItem of Object.values(document.paths)) {
    if (!isRecord(pathItem)) continue;
    for (const operation of Object.values(pathItem)) {
      if (!isRecord(operation) || !isRecord(operation['responses'])) continue;
      for (const [status, response] of Object.entries(operation['responses'])) {
        if (!/^2\d\d$/.test(status) || status === '204' || !isRecord(response)) continue;
        const content = response['content'];
        if (!isRecord(content)) continue;
        const json = content['application/json'];
        if (!isRecord(json)) continue;
        const example = json['example'];
        if (example === null) continue;
        const schema = json['schema'];
        json['schema'] = {
          type: 'object',
          required: ['success', 'meta', 'data'],
          properties: {
            success: { type: 'boolean', example: true },
            meta: {
              type: 'object',
              required: ['requestId', 'correlationId', 'timestamp'],
              properties: {
                requestId: { type: 'string', example: 'req_swagger_example' },
                correlationId: { type: 'string', example: 'corr_swagger_example' },
                timestamp: { type: 'string', format: 'date-time' },
              },
            },
            data: schema ?? { type: 'object' },
          },
        };
        if (example !== undefined) {
          json['example'] = {
            success: true,
            meta: {
              requestId: 'req_swagger_example',
              correlationId: 'corr_swagger_example',
              timestamp: '2026-08-12T12:00:00.000Z',
            },
            data: example,
          };
        }
      }
    }
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
