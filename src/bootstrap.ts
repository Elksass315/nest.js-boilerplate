import { RequestMethod, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';

import { AppModule } from './app.module';
import { parseCorsOrigins, type EnvironmentVariables } from './config/environment';

export async function createApplication(): Promise<NestExpressApplication> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: true });
  const configService = app.get(ConfigService<EnvironmentVariables, true>);
  const apiPrefix = configService.getOrThrow('API_PREFIX', { infer: true });
  const apiVersion = configService.getOrThrow('API_VERSION', { infer: true });
  const corsOrigins = parseCorsOrigins(configService.getOrThrow('CORS_ORIGINS', { infer: true }));

  app.useLogger(app.get(Logger));
  app.use(helmet());
  app.enableCors({
    origin: corsOrigins,
    credentials: true,
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: false },
      stopAtFirstError: false,
    }),
  );
  app.setGlobalPrefix(`${apiPrefix}/v${apiVersion}`, {
    exclude: [
      { path: 'health/live', method: RequestMethod.GET },
      { path: 'health/ready', method: RequestMethod.GET },
    ],
  });
  app.enableShutdownHooks();

  if (configService.getOrThrow('SWAGGER_ENABLED', { infer: true })) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('NestJS SaaS API')
      .setDescription('Single-tenant SaaS platform API')
      .setVersion(apiVersion)
      .addBearerAuth()
      .build();
    SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, swaggerConfig), {
      customSiteTitle: 'NestJS SaaS API Documentation',
    });
  }

  return app;
}
