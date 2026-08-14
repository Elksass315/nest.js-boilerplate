import type Redis from 'ioredis';

import { RedisTusLocker } from './redis-tus-locker';

describe(RedisTusLocker.name, () => {
  const redis = { set: jest.fn(), eval: jest.fn() };

  beforeEach(() => jest.clearAllMocks());

  it('acquires and token-releases a Redis lease', async () => {
    redis.set.mockResolvedValue('OK');
    redis.eval.mockResolvedValue(1);
    const lock = new RedisTusLocker(redis as unknown as Redis).newLock('upload-1');
    await lock.lock(new AbortController().signal, () => undefined);
    await lock.unlock();
    expect(redis.set).toHaveBeenCalledWith(
      'files:tus-lock:upload-1',
      expect.any(String),
      'PX',
      600_000,
      'NX',
    );
    expect(redis.eval).toHaveBeenCalled();
  });

  it('does not release a lease that was never acquired', async () => {
    const lock = new RedisTusLocker(redis as unknown as Redis).newLock('upload-1');
    await lock.unlock();
    expect(redis.eval).not.toHaveBeenCalled();
  });
});
