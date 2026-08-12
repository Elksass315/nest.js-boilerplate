import Joi from 'joi';

import type { AuthConfig } from './configuration.types';
import { readNumber, readString } from './environment-reader';

export const authEnvironmentSchema = {
  AUTH_ACCESS_TOKEN_SECRET: Joi.string().min(32).max(512).required(),
  AUTH_TOKEN_ISSUER: Joi.string().trim().min(3).max(120).default('nestjs-saas-api'),
  AUTH_TOKEN_AUDIENCE: Joi.string().trim().min(3).max(120).default('nestjs-saas-clients'),
  AUTH_ACCESS_TOKEN_TTL_SECONDS: Joi.number().integer().min(60).max(3600).default(900),
  AUTH_SESSION_TTL_SECONDS: Joi.number().integer().min(3600).max(2592000).default(1209600),
  AUTH_VERIFICATION_TOKEN_TTL_SECONDS: Joi.number().integer().min(300).max(604800).default(86400),
  AUTH_PASSWORD_RESET_TOKEN_TTL_SECONDS: Joi.number().integer().min(300).max(86400).default(1800),
  AUTH_MAX_ACTIVE_SESSIONS: Joi.number().integer().min(1).max(20).default(5),
  AUTH_MAX_FAILED_LOGIN_ATTEMPTS: Joi.number().integer().min(3).max(20).default(5),
  AUTH_LOGIN_LOCK_SECONDS: Joi.number().integer().min(60).max(86400).default(900),
} satisfies Record<string, Joi.Schema>;

export function createAuthConfig(environment: Record<string, unknown>): AuthConfig {
  return {
    accessTokenSecret: readString(environment, 'AUTH_ACCESS_TOKEN_SECRET'),
    tokenIssuer: readString(environment, 'AUTH_TOKEN_ISSUER'),
    tokenAudience: readString(environment, 'AUTH_TOKEN_AUDIENCE'),
    accessTokenTtlSeconds: readNumber(environment, 'AUTH_ACCESS_TOKEN_TTL_SECONDS'),
    sessionTtlSeconds: readNumber(environment, 'AUTH_SESSION_TTL_SECONDS'),
    verificationTokenTtlSeconds: readNumber(environment, 'AUTH_VERIFICATION_TOKEN_TTL_SECONDS'),
    passwordResetTokenTtlSeconds: readNumber(environment, 'AUTH_PASSWORD_RESET_TOKEN_TTL_SECONDS'),
    maxActiveSessions: readNumber(environment, 'AUTH_MAX_ACTIVE_SESSIONS'),
    maxFailedLoginAttempts: readNumber(environment, 'AUTH_MAX_FAILED_LOGIN_ATTEMPTS'),
    loginLockSeconds: readNumber(environment, 'AUTH_LOGIN_LOCK_SECONDS'),
  };
}
