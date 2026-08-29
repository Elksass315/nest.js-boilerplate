import { Inject, Injectable } from '@nestjs/common';
import type Redis from 'ioredis';
import { DataSource } from 'typeorm';

import { REDIS_CLIENT } from '@/redis/redis.constants';
import { AppException } from '@/core/errors/app.exception';
import type { LivenessResponse, ReadinessResponse } from './health.types';
import { ReadinessRegistry } from './readiness-registry.service';

@Injectable()
export class HealthService {
  public constructor(
    private readonly dataSource: DataSource,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    private readonly readiness: ReadinessRegistry,
  ) {}

  public getLiveness(): LivenessResponse {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor(process.uptime()),
    };
  }

  public async getReadiness(): Promise<ReadinessResponse> {
    const [database, redis, capabilities] = await Promise.all([
      Promise.resolve(this.dataSource.query('SELECT 1')).then(
        () => 'up' as const,
        () => 'down' as const,
      ),
      Promise.resolve(this.redis.ping()).then(
        () => 'up' as const,
        () => 'down' as const,
      ),
      this.readiness.run(),
    ]);
    const checks = {
      database,
      redis,
      ...capabilities,
    };
    if (Object.values(checks).some((state) => state === 'down')) {
      throw new AppException('SERVICE_NOT_READY', { checks });
    }

    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      checks,
    };
  }
}
