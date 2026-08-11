import { Inject, Injectable, type OnApplicationShutdown, type OnModuleInit } from '@nestjs/common';
import type Redis from 'ioredis';

import { REDIS_CLIENT } from './redis.constants';

@Injectable()
export class RedisLifecycleService implements OnModuleInit, OnApplicationShutdown {
  public constructor(@Inject(REDIS_CLIENT) private readonly client: Redis) {}

  public async onModuleInit(): Promise<void> {
    await this.client.connect();
  }

  public async onApplicationShutdown(): Promise<void> {
    if (this.client.status !== 'end') {
      await this.client.quit();
    }
  }
}
