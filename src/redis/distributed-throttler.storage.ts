import { Inject, Injectable } from '@nestjs/common';
import type { ThrottlerStorage } from '@nestjs/throttler';
import type Redis from 'ioredis';

import { REDIS_CLIENT } from './redis.constants';

const INCREMENT_SCRIPT = `
local current = redis.call('INCR', KEYS[1])
if current == 1 then redis.call('PEXPIRE', KEYS[1], ARGV[1]) end
local ttl = redis.call('PTTL', KEYS[1])
local blocked = redis.call('PTTL', KEYS[2])
if current > tonumber(ARGV[2]) and blocked < 0 then
  redis.call('SET', KEYS[2], '1', 'PX', ARGV[3])
  blocked = tonumber(ARGV[3])
end
return { current, ttl, blocked }
`;

interface ThrottlerStorageRecord {
  totalHits: number;
  timeToExpire: number;
  isBlocked: boolean;
  timeToBlockExpire: number;
}

@Injectable()
export class DistributedThrottlerStorage implements ThrottlerStorage {
  public constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  public async increment(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
  ): Promise<ThrottlerStorageRecord> {
    const result = (await this.redis.eval(
      INCREMENT_SCRIPT,
      2,
      `throttle:${key}`,
      `throttle:${key}:block`,
      String(ttl),
      String(limit),
      String(blockDuration),
    )) as [number, number, number];
    const timeToExpire = Math.max(0, result[1]);
    const timeToBlockExpire = Math.max(0, result[2]);
    return {
      totalHits: result[0],
      timeToExpire,
      isBlocked: timeToBlockExpire > 0,
      timeToBlockExpire,
    };
  }
}
