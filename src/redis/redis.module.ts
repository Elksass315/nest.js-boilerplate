import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

import type { AppConfiguration } from '@/config/configuration.types';

import { REDIS_CLIENT } from './redis.constants';
import { RedisLifecycleService } from './redis-lifecycle.service';

@Global()
@Module({
  providers: [
    {
      provide: REDIS_CLIENT,
      inject: [ConfigService],
      useFactory: (configService: ConfigService<AppConfiguration, true>): Redis =>
        new Redis({
          host: configService.getOrThrow('redis.host', { infer: true }),
          port: configService.getOrThrow('redis.port', { infer: true }),
          password: configService.getOrThrow('redis.password', { infer: true }) || undefined,
          db: configService.getOrThrow('redis.db', { infer: true }),
          connectTimeout: configService.getOrThrow('redis.connectTimeoutMs', { infer: true }),
          lazyConnect: true,
          enableReadyCheck: true,
          maxRetriesPerRequest: 1,
          retryStrategy: (attempt: number) => Math.min(attempt * 200, 2000),
        }),
    },
    RedisLifecycleService,
  ],
  exports: [REDIS_CLIENT],
})
export class RedisModule {}
