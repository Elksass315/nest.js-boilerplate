import type Redis from 'ioredis';
import type { DataSource } from 'typeorm';

import { AppException } from '@/core/errors/app.exception';
import { HealthService } from './health.service';
import type { ReadinessRegistry } from './readiness-registry.service';

describe(HealthService.name, () => {
  const dataSource = { query: jest.fn() } as unknown as DataSource;
  const redis = { ping: jest.fn() } as unknown as Redis;
  const readiness = { run: jest.fn() } as unknown as ReadinessRegistry;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('reports process liveness', () => {
    const result = new HealthService(dataSource, redis, readiness).getLiveness();

    expect(result.status).toBe('ok');
    expect(result.uptimeSeconds).toBeGreaterThanOrEqual(0);
  });

  it('reports readiness when PostgreSQL and Redis respond', async () => {
    jest.mocked(dataSource.query).mockResolvedValue([{ '?column?': 1 }]);
    jest.mocked(redis.ping).mockResolvedValue('PONG');
    jest.mocked(readiness.run).mockResolvedValue({ storage: 'up' });

    await expect(new HealthService(dataSource, redis, readiness).getReadiness()).resolves.toEqual(
      expect.objectContaining({
        status: 'ok',
        checks: { database: 'up', redis: 'up', storage: 'up' },
      }),
    );
  });

  it('rejects readiness when a dependency is unavailable', async () => {
    jest.mocked(dataSource.query).mockRejectedValue(new Error('database unavailable'));
    jest.mocked(redis.ping).mockResolvedValue('PONG');
    jest.mocked(readiness.run).mockResolvedValue({});

    await expect(
      new HealthService(dataSource, redis, readiness).getReadiness(),
    ).rejects.toBeInstanceOf(AppException);
  });

  it('rejects readiness when file storage is unavailable', async () => {
    jest.mocked(dataSource.query).mockResolvedValue([{ '?column?': 1 }]);
    jest.mocked(redis.ping).mockResolvedValue('PONG');
    jest.mocked(readiness.run).mockResolvedValue({ storage: 'down' });

    await expect(
      new HealthService(dataSource, redis, readiness).getReadiness(),
    ).rejects.toBeInstanceOf(AppException);
  });
});
