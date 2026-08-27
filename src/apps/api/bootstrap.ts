import { RequestMethod, ValidationPipe, VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface';
import type { NestExpressApplication } from '@nestjs/platform-express';
import type { Request } from 'express';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';

import { configureSwagger } from '@/common/swagger/configure-swagger';
import type { AppConfiguration } from '@/config/configuration.types';
import { validationPipeOptions } from '@/core/errors/validation-pipe-options';

import { AppModule } from './app.module';

export async function createApplication(
  options: { configureDocumentation?: boolean } = {},
): Promise<NestExpressApplication> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: true });
  const config = app.get(ConfigService<AppConfiguration, true>);

  app.useLogger(app.get(Logger));
  app.use(helmet());
  const corsOptions: CorsOptions = {
    origin: config.getOrThrow('cors.origins', { infer: true }),
    credentials: true,
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  };
  app.enableCors((request: Request, callback) => {
    callback(null, {
      ...corsOptions,
      preflightContinue:
        request.method === 'OPTIONS' && request.path.endsWith('/v1/users/me/avatar/uploads'),
    });
  });
  app.useGlobalPipes(new ValidationPipe(validationPipeOptions));
  app.setGlobalPrefix(config.getOrThrow('app.apiPrefix', { infer: true }), {
    exclude: [
      { path: 'health/live', method: RequestMethod.GET },
      { path: 'health/ready', method: RequestMethod.GET },
    ],
  });
  app.enableVersioning({ type: VersioningType.URI, prefix: 'v' });
  app.enableShutdownHooks();
  if (options.configureDocumentation !== false) configureSwagger(app, config);

  return app;
}
