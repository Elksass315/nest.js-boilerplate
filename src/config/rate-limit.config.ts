import Joi from 'joi';

import type { RateLimitConfig } from './configuration.types';
import { readNumber } from './environment-reader';

export const rateLimitEnvironmentSchema = {
  RATE_LIMIT_TTL_MS: Joi.number().integer().min(1000).default(60000),
  RATE_LIMIT_MAX: Joi.number().integer().min(1).default(100),
} satisfies Record<string, Joi.Schema>;

export function createRateLimitConfig(environment: Record<string, unknown>): RateLimitConfig {
  return {
    ttlMs: readNumber(environment, 'RATE_LIMIT_TTL_MS'),
    max: readNumber(environment, 'RATE_LIMIT_MAX'),
  };
}
