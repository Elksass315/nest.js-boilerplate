import { Inject, Injectable, ServiceUnavailableException } from '@nestjs/common';
import type Redis from 'ioredis';
import { DataSource } from 'typeorm';

import { REDIS_CLIENT } from '@/redis/redis.constants';

import type { LivenessResponse, ReadinessResponse } from './health.types';

@Injectable()
export class HealthService {
  public constructor(
    private readonly dataSource: DataSource,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  public getLiveness(): LivenessResponse {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor(process.uptime()),
    };
  }

  public async getReadiness(): Promise<ReadinessResponse> {
    const [database, redis] = await Promise.allSettled([
      this.dataSource.query('SELECT 1'),
      this.redis.ping(),
    ]);
    const checks = {
      database: database.status === 'fulfilled' ? 'up' : 'down',
      redis: redis.status === 'fulfilled' ? 'up' : 'down',
    } as const;

    if (checks.database === 'down' || checks.redis === 'down') {
      throw new ServiceUnavailableException({
        code: 'SERVICE_NOT_READY',
        message: 'One or more required services are unavailable',
        details: { checks },
      });
    }

    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      checks: { database: 'up', redis: 'up' },
    };
  }
}
