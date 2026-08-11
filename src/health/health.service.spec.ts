import type Redis from 'ioredis';
import type { DataSource } from 'typeorm';

import { AppException } from '@/core/errors/app.exception';

import { HealthService } from './health.service';

describe(HealthService.name, () => {
  const dataSource = { query: jest.fn() } as unknown as DataSource;
  const redis = { ping: jest.fn() } as unknown as Redis;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('reports process liveness', () => {
    const result = new HealthService(dataSource, redis).getLiveness();

    expect(result.status).toBe('ok');
    expect(result.uptimeSeconds).toBeGreaterThanOrEqual(0);
  });

  it('reports readiness when PostgreSQL and Redis respond', async () => {
    jest.mocked(dataSource.query).mockResolvedValue([{ '?column?': 1 }]);
    jest.mocked(redis.ping).mockResolvedValue('PONG');

    await expect(new HealthService(dataSource, redis).getReadiness()).resolves.toEqual(
      expect.objectContaining({
        status: 'ok',
        checks: { database: 'up', redis: 'up' },
      }),
    );
  });

  it('rejects readiness when a dependency is unavailable', async () => {
    jest.mocked(dataSource.query).mockRejectedValue(new Error('database unavailable'));
    jest.mocked(redis.ping).mockResolvedValue('PONG');

    await expect(new HealthService(dataSource, redis).getReadiness()).rejects.toBeInstanceOf(
      AppException,
    );
  });
});
