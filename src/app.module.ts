import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';

import { GlobalExceptionFilter } from '@/common/errors/global-exception.filter';
import { createLoggerOptions } from '@/common/logging/logger-options';
import { type EnvironmentVariables, validateEnvironment } from '@/config/environment';
import { DatabaseModule } from '@/database/database.module';
import { HealthModule } from '@/health/health.module';
import { RedisModule } from '@/redis/redis.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      expandVariables: false,
      validate: validateEnvironment,
    }),
    LoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService<EnvironmentVariables, true>) =>
        createLoggerOptions(configService.getOrThrow('LOG_LEVEL', { infer: true })),
    }),
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService<EnvironmentVariables, true>) => [
        {
          ttl: configService.getOrThrow('RATE_LIMIT_TTL_MS', { infer: true }),
          limit: configService.getOrThrow('RATE_LIMIT_MAX', { infer: true }),
        },
      ],
    }),
    DatabaseModule,
    RedisModule,
    HealthModule,
  ],
  providers: [
    { provide: APP_FILTER, useClass: GlobalExceptionFilter },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
