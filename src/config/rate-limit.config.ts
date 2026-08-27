import Joi from 'joi';
import { isIP } from 'node:net';

import type { RateLimitConfig } from './configuration.types';
import { readNumber, readString } from './environment-reader';

export const rateLimitEnvironmentSchema = {
  RATE_LIMIT_TTL_MS: Joi.number().integer().min(1000).default(60000),
  RATE_LIMIT_MAX: Joi.number().integer().min(1).default(100),
  RATE_LIMIT_AUTH_TTL_MS: Joi.number().integer().min(1000).default(60000),
  RATE_LIMIT_AUTH_MAX: Joi.number().integer().min(1).default(20),
  RATE_LIMIT_OTP_TTL_MS: Joi.number().integer().min(1000).default(600000),
  RATE_LIMIT_OTP_MAX: Joi.number().integer().min(1).default(5),
  RATE_LIMIT_RECOVERY_TTL_MS: Joi.number().integer().min(1000).default(3600000),
  RATE_LIMIT_RECOVERY_MAX: Joi.number().integer().min(1).default(5),
  RATE_LIMIT_EMAIL_TTL_MS: Joi.number().integer().min(1000).default(3600000),
  RATE_LIMIT_EMAIL_MAX: Joi.number().integer().min(1).default(20),
  TRUSTED_PROXY_IPS: Joi.string().trim().default(''),
} satisfies Record<string, Joi.Schema>;

export function parseTrustedProxyIps(value: string): string[] {
  const ips = [
    ...new Set(
      value
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  ];
  if (ips.some((ip) => !isValidIp(ip)))
    throw new Error('TRUSTED_PROXY_IPS must contain valid IP addresses');
  return ips;
}

export function createRateLimitConfig(environment: Record<string, unknown>): RateLimitConfig {
  return {
    global: policy(environment, 'RATE_LIMIT_TTL_MS', 'RATE_LIMIT_MAX'),
    authentication: policy(environment, 'RATE_LIMIT_AUTH_TTL_MS', 'RATE_LIMIT_AUTH_MAX'),
    otp: policy(environment, 'RATE_LIMIT_OTP_TTL_MS', 'RATE_LIMIT_OTP_MAX'),
    recovery: policy(environment, 'RATE_LIMIT_RECOVERY_TTL_MS', 'RATE_LIMIT_RECOVERY_MAX'),
    emailDelivery: policy(environment, 'RATE_LIMIT_EMAIL_TTL_MS', 'RATE_LIMIT_EMAIL_MAX'),
    trustedProxyIps: parseTrustedProxyIps(readString(environment, 'TRUSTED_PROXY_IPS')),
  };
}

function policy(
  environment: Record<string, unknown>,
  ttlKey: string,
  maxKey: string,
): { ttlMs: number; max: number } {
  return { ttlMs: readNumber(environment, ttlKey), max: readNumber(environment, maxKey) };
}

function isValidIp(value: string): boolean {
  return isIP(value) !== 0;
}
