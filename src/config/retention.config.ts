import Joi from 'joi';

import type { RetentionConfig } from './configuration.types';
import { readBoolean, readNumber } from './environment-reader';

export const retentionEnvironmentSchema = {
  RETENTION_ENABLED: Joi.boolean().truthy('true').falsy('false').default(true),
  RETENTION_INTERVAL_MS: Joi.number().integer().min(60000).max(86400000).default(900000),
  RETENTION_BATCH_SIZE: Joi.number().integer().min(1).max(1000).default(100),
  RETENTION_AUTH_TOKEN_DAYS: Joi.number().integer().min(0).max(3650).default(30),
  RETENTION_SESSION_DAYS: Joi.number().integer().min(0).max(3650).default(30),
  RETENTION_MAIL_DAYS: Joi.number().integer().min(0).max(3650).default(90),
  RETENTION_OUTBOX_DAYS: Joi.number().integer().min(0).max(3650).default(30),
  RETENTION_OUTBOX_FAILURE_DAYS: Joi.number().integer().min(0).max(3650).default(365),
} satisfies Record<string, Joi.Schema>;

export function createRetentionConfig(environment: Record<string, unknown>): RetentionConfig {
  return {
    enabled: readBoolean(environment, 'RETENTION_ENABLED'),
    intervalMs: readNumber(environment, 'RETENTION_INTERVAL_MS'),
    batchSize: readNumber(environment, 'RETENTION_BATCH_SIZE'),
    authTokenDays: readNumber(environment, 'RETENTION_AUTH_TOKEN_DAYS'),
    sessionDays: readNumber(environment, 'RETENTION_SESSION_DAYS'),
    mailDays: readNumber(environment, 'RETENTION_MAIL_DAYS'),
    outboxDays: readNumber(environment, 'RETENTION_OUTBOX_DAYS'),
    outboxFailureDays: readNumber(environment, 'RETENTION_OUTBOX_FAILURE_DAYS'),
  };
}
