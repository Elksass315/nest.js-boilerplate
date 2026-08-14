import { randomUUID } from 'node:crypto';

import { Inject, Injectable } from '@nestjs/common';
import type { Lock, Locker, RequestRelease } from '@tus/server';
import type Redis from 'ioredis';

import { REDIS_CLIENT } from '@/redis/redis.constants';

@Injectable()
export class RedisTusLocker implements Locker {
  public constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  public newLock(id: string): Lock {
    return new RedisTusLock(this.redis, `files:tus-lock:${id}`);
  }
}

class RedisTusLock implements Lock {
  private readonly token = randomUUID();
  private acquired = false;

  public constructor(
    private readonly redis: Redis,
    private readonly key: string,
  ) {}

  public async lock(signal: AbortSignal, requestRelease: RequestRelease): Promise<void> {
    const deadline = Date.now() + 30_000;
    let releaseRequested = false;
    while (!signal.aborted && Date.now() < deadline) {
      const acquired = await this.redis.set(this.key, this.token, 'PX', 600_000, 'NX');
      if (acquired === 'OK') {
        this.acquired = true;
        return;
      }
      if (!releaseRequested) {
        await requestRelease();
        releaseRequested = true;
      }
      await waitForRetry(signal);
    }
    throw new TusLockTimeoutError();
  }

  public async unlock(): Promise<void> {
    if (!this.acquired) return;
    await this.redis.eval(
      "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end",
      1,
      this.key,
      this.token,
    );
    this.acquired = false;
  }
}

function waitForRetry(signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const onAbort = (): void => {
      clearTimeout(timeout);
      resolve();
    };
    const timeout = setTimeout(() => {
      signal.removeEventListener('abort', onAbort);
      resolve();
    }, 50);
    signal.addEventListener('abort', onAbort, { once: true });
  });
}

class TusLockTimeoutError extends Error {
  public readonly status_code = 500;
  public readonly body = 'failed to acquire lock before timeout';

  public constructor() {
    super('failed to acquire lock before timeout');
  }
}
