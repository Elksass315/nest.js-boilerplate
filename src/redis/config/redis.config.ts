import Joi from 'joi';

import { readNumber, readString } from '@/config/environment-reader';

export interface RedisConfig {
  host: string;
  port: number;
  password: string;
  db: number;
  connectTimeoutMs: number;
}

export const redisEnvironmentSchema = {
  REDIS_HOST: Joi.string().hostname().required(),
  REDIS_PORT: Joi.number().port().default(6379),
  REDIS_PASSWORD: Joi.string().allow('').default(''),
  REDIS_DB: Joi.number().integer().min(0).max(15).default(0),
  REDIS_CONNECT_TIMEOUT_MS: Joi.number().integer().min(500).max(60000).default(5000),
} satisfies Record<string, Joi.Schema>;

export function createRedisConfig(environment: Record<string, unknown>): RedisConfig {
  return {
    host: readString(environment, 'REDIS_HOST'),
    port: readNumber(environment, 'REDIS_PORT'),
    password: readString(environment, 'REDIS_PASSWORD'),
    db: readNumber(environment, 'REDIS_DB'),
    connectTimeoutMs: readNumber(environment, 'REDIS_CONNECT_TIMEOUT_MS'),
  };
}
