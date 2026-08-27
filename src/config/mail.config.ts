import Joi from 'joi';

import type { MailConfig } from './configuration.types';
import { readBoolean, readNumber, readString } from './environment-reader';

export const mailEnvironmentSchema = {
  MAIL_ENABLED: Joi.boolean().default(false),
  MAIL_FROM_ADDRESS: Joi.string().email().default('noreply@example.com'),
  MAIL_FROM_NAME: Joi.string().trim().min(1).max(100).default('NestJS SaaS'),
  MAIL_ACTION_BASE_URL: Joi.string()
    .uri({ scheme: ['http', 'https'] })
    .default('http://localhost:3000'),
  MAIL_SMTP_HOST: Joi.string().hostname().default('mailpit'),
  MAIL_SMTP_PORT: Joi.number().port().default(1025),
  MAIL_SMTP_SECURE: Joi.boolean().default(false),
  MAIL_SMTP_REQUIRE_TLS: Joi.boolean().default(false),
  MAIL_SMTP_USERNAME: Joi.string().allow('').max(320).default(''),
  MAIL_SMTP_PASSWORD: Joi.string().allow('').max(512).default(''),
  MAIL_MAX_RETRIES: Joi.number().integer().min(1).max(10).default(5),
  MAIL_RETRY_DELAY_MS: Joi.number().integer().min(1000).max(300000).default(30000),
  MAIL_WORKER_CONCURRENCY: Joi.number().integer().min(1).max(50).default(5),
  MAIL_SMTP_CONNECTION_TIMEOUT_MS: Joi.number().integer().min(1000).max(60000).default(10000),
  MAIL_SMTP_SOCKET_TIMEOUT_MS: Joi.number().integer().min(1000).max(120000).default(30000),
  MAIL_BRANDING_PRIMARY_COLOR: Joi.string()
    .pattern(/^#[0-9A-Fa-f]{6}$/)
    .default('#4F46E5'),
  MAIL_BRANDING_SECONDARY_COLOR: Joi.string()
    .pattern(/^#[0-9A-Fa-f]{6}$/)
    .default('#7C3AED'),
  MAIL_BRANDING_LOGO_URL: Joi.string()
    .allow('')
    .uri({ scheme: ['http', 'https'] })
    .default(''),
  MAIL_BRANDING_COMPANY_NAME: Joi.string().trim().min(1).max(100).default('NestJS SaaS'),
  MAIL_BRANDING_SUPPORT_EMAIL: Joi.string().email().default('support@example.com'),
} satisfies Record<string, Joi.Schema>;

export function createMailConfig(environment: Record<string, unknown>): MailConfig {
  return {
    enabled: readBoolean(environment, 'MAIL_ENABLED'),
    fromAddress: readString(environment, 'MAIL_FROM_ADDRESS'),
    fromName: readString(environment, 'MAIL_FROM_NAME'),
    actionBaseUrl: readString(environment, 'MAIL_ACTION_BASE_URL'),
    smtpHost: readString(environment, 'MAIL_SMTP_HOST'),
    smtpPort: readNumber(environment, 'MAIL_SMTP_PORT'),
    smtpSecure: readBoolean(environment, 'MAIL_SMTP_SECURE'),
    smtpRequireTls: readBoolean(environment, 'MAIL_SMTP_REQUIRE_TLS'),
    smtpUsername: readString(environment, 'MAIL_SMTP_USERNAME'),
    smtpPassword: readString(environment, 'MAIL_SMTP_PASSWORD'),
    maxRetries: readNumber(environment, 'MAIL_MAX_RETRIES'),
    retryDelayMs: readNumber(environment, 'MAIL_RETRY_DELAY_MS'),
    workerConcurrency: readNumber(environment, 'MAIL_WORKER_CONCURRENCY'),
    smtpConnectionTimeoutMs: readNumber(environment, 'MAIL_SMTP_CONNECTION_TIMEOUT_MS'),
    smtpSocketTimeoutMs: readNumber(environment, 'MAIL_SMTP_SOCKET_TIMEOUT_MS'),
    branding: {
      primaryColor: readString(environment, 'MAIL_BRANDING_PRIMARY_COLOR'),
      secondaryColor: readString(environment, 'MAIL_BRANDING_SECONDARY_COLOR'),
      logoUrl: readString(environment, 'MAIL_BRANDING_LOGO_URL'),
      companyName: readString(environment, 'MAIL_BRANDING_COMPANY_NAME'),
      supportEmail: readString(environment, 'MAIL_BRANDING_SUPPORT_EMAIL'),
    },
  };
}
