import type Redis from 'ioredis';

import { DistributedThrottlerStorage } from './distributed-throttler.storage';

describe(DistributedThrottlerStorage.name, () => {
  it('uses one atomic Redis script and returns the window state', async () => {
    const redis = { eval: jest.fn().mockResolvedValue([3, 59_000, 0]) } as unknown as Redis;
    const storage = new DistributedThrottlerStorage(redis);

    await expect(storage.increment('key', 60_000, 5, 60_000, 'auth')).resolves.toEqual({
      totalHits: 3,
      timeToExpire: 59_000,
      isBlocked: false,
      timeToBlockExpire: 0,
    });
    expect(redis.eval).toHaveBeenCalledWith(
      expect.stringContaining('INCR'),
      2,
      'throttle:key',
      'throttle:key:block',
      '60000',
      '5',
      '60000',
    );
  });

  it('reports blocked windows and never relies on process-local state', async () => {
    const redis = { eval: jest.fn().mockResolvedValue([6, 58_000, 30_000]) } as unknown as Redis;
    await expect(
      new DistributedThrottlerStorage(redis).increment('key', 60_000, 5, 30_000, 'auth'),
    ).resolves.toMatchObject({ totalHits: 6, isBlocked: true, timeToBlockExpire: 30_000 });
  });
});
