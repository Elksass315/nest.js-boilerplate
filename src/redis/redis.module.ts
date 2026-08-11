import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

import type { EnvironmentVariables } from '@/config/environment';

import { REDIS_CLIENT } from './redis.constants';
import { RedisLifecycleService } from './redis-lifecycle.service';

@Global()
@Module({
  providers: [
    {
      provide: REDIS_CLIENT,
      inject: [ConfigService],
      useFactory: (configService: ConfigService<EnvironmentVariables, true>): Redis =>
        new Redis({
          host: configService.getOrThrow('REDIS_HOST', { infer: true }),
          port: configService.getOrThrow('REDIS_PORT', { infer: true }),
          password: configService.getOrThrow('REDIS_PASSWORD', { infer: true }) || undefined,
          db: configService.getOrThrow('REDIS_DB', { infer: true }),
          connectTimeout: configService.getOrThrow('REDIS_CONNECT_TIMEOUT_MS', { infer: true }),
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
