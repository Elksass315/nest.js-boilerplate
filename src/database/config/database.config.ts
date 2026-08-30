import Joi from 'joi';

import { readBoolean, readNumber, readString } from '@/config/environment-reader';

export interface DatabaseConfig {
  host: string;
  port: number;
  name: string;
  username: string;
  password: string;
  sslEnabled: boolean;
  rejectUnauthorized: boolean;
  poolSize: number;
  connectTimeoutMs: number;
}

export const databaseEnvironmentSchema = {
  DATABASE_HOST: Joi.string().hostname().required(),
  DATABASE_PORT: Joi.number().port().default(5432),
  DATABASE_NAME: Joi.string()
    .pattern(/^[a-zA-Z0-9_-]+$/)
    .required(),
  DATABASE_USERNAME: Joi.string().required(),
  DATABASE_PASSWORD: Joi.string().min(4).required(),
  DATABASE_SSL_ENABLED: Joi.boolean().truthy('true').falsy('false').default(false),
  DATABASE_REJECT_UNAUTHORIZED: Joi.boolean().truthy('true').falsy('false').default(true),
  DATABASE_POOL_SIZE: Joi.number().integer().min(1).max(100).default(20),
  DATABASE_CONNECT_TIMEOUT_MS: Joi.number().integer().min(500).max(60000).default(5000),
} satisfies Record<string, Joi.Schema>;

export function createDatabaseConfig(environment: Record<string, unknown>): DatabaseConfig {
  return {
    host: readString(environment, 'DATABASE_HOST'),
    port: readNumber(environment, 'DATABASE_PORT'),
    name: readString(environment, 'DATABASE_NAME'),
    username: readString(environment, 'DATABASE_USERNAME'),
    password: readString(environment, 'DATABASE_PASSWORD'),
    sslEnabled: readBoolean(environment, 'DATABASE_SSL_ENABLED'),
    rejectUnauthorized: readBoolean(environment, 'DATABASE_REJECT_UNAUTHORIZED'),
    poolSize: readNumber(environment, 'DATABASE_POOL_SIZE'),
    connectTimeoutMs: readNumber(environment, 'DATABASE_CONNECT_TIMEOUT_MS'),
  };
}
