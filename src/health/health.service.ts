import { Inject, Injectable } from '@nestjs/common';
import type Redis from 'ioredis';
import { DataSource } from 'typeorm';

import { REDIS_CLIENT } from '@/redis/redis.constants';
import { AppException } from '@/core/errors/app.exception';
import { FilesService } from '@/modules/files';

import type { LivenessResponse, ReadinessResponse } from './health.types';

@Injectable()
export class HealthService {
  public constructor(
    private readonly dataSource: DataSource,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    private readonly files: FilesService,
  ) {}

  public getLiveness(): LivenessResponse {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor(process.uptime()),
    };
  }

  public async getReadiness(): Promise<ReadinessResponse> {
    const [database, redis, storage] = await Promise.allSettled([
      this.dataSource.query('SELECT 1'),
      this.redis.ping(),
      this.files.checkStorageHealth(),
    ]);
    const checks = {
      database: database.status === 'fulfilled' ? 'up' : 'down',
      redis: redis.status === 'fulfilled' ? 'up' : 'down',
      storage: storage.status === 'fulfilled' ? 'up' : 'down',
    } as const;

    if (checks.database === 'down' || checks.redis === 'down' || checks.storage === 'down') {
      throw new AppException('SERVICE_NOT_READY', { checks });
    }

    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      checks: { database: 'up', redis: 'up', storage: 'up' },
    };
  }
}
