import Joi from 'joi';

import type { AppConfig, NodeEnvironment } from './configuration.types';
import { readNumber, readString } from './environment-reader';

export const appEnvironmentSchema = {
  NODE_ENV: Joi.string()
    .valid('development', 'test', 'staging', 'production')
    .default('development'),
  APP_NAME: Joi.string().trim().min(1).max(80).default('NestJS SaaS API'),
  APP_BASE_URL: Joi.string()
    .uri({ scheme: ['http', 'https'] })
    .default('http://localhost:3000'),
  PORT: Joi.number().port().default(3000),
  API_PREFIX: Joi.string()
    .pattern(/^[a-z][a-z0-9-]*$/)
    .default('api'),
} satisfies Record<string, Joi.Schema>;

export function createAppConfig(environment: Record<string, unknown>): AppConfig {
  return {
    nodeEnv: readString(environment, 'NODE_ENV') as NodeEnvironment,
    name: readString(environment, 'APP_NAME'),
    baseUrl: readString(environment, 'APP_BASE_URL').replace(/\/+$/, ''),
    port: readNumber(environment, 'PORT'),
    apiPrefix: readString(environment, 'API_PREFIX'),
  };
}
