import { Module } from '@nestjs/common';
import { SentryModule } from '@sentry/nestjs/setup';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';

import { createLoggerOptions } from '@/common/logging/logger-options';
import type { AppConfiguration } from '@/config/configuration.types';
import { loadApiConfiguration } from '@/config/environment';
import { CoreModule } from '@/core/core.module';
import { GlobalExceptionFilter } from '@/core/errors/global-exception.filter';
import { AppI18nModule } from '@/core/i18n/i18n.module';
import { DatabaseModule } from '@/database/database.module';
import { HealthModule } from '@/health/health.module';
import { AuthorizationModule } from '@/modules/authorization';
import { AuthModule } from '@/modules/auth';
import { FilesModule } from '@/modules/files';
import { FeatureFlagsModule } from '@/modules/feature-flags';
import { InvitationsModule } from '@/modules/invitations';
import { UsersModule } from '@/modules/users';
import { RedisModule } from '@/redis/redis.module';

@Module({
  imports: [
    SentryModule.forRoot(),
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      expandVariables: false,
      load: [loadApiConfiguration],
    }),
    LoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<AppConfiguration, true>) =>
        createLoggerOptions(config.getOrThrow('logging.level', { infer: true })),
    }),
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<AppConfiguration, true>) => [
        {
          ttl: config.getOrThrow('rateLimit.ttlMs', { infer: true }),
          limit: config.getOrThrow('rateLimit.max', { infer: true }),
        },
      ],
    }),
    AppI18nModule,
    CoreModule,
    DatabaseModule,
    RedisModule,
    HealthModule,
    AuthorizationModule,
    UsersModule,
    AuthModule,
    FilesModule,
    FeatureFlagsModule,
    InvitationsModule,
  ],
  providers: [
    { provide: APP_FILTER, useClass: GlobalExceptionFilter },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
