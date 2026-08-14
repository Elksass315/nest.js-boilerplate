import Joi from 'joi';

import type { LoggingConfig, LogLevel } from './configuration.types';
import { readString } from './environment-reader';

export const loggingEnvironmentSchema = {
  LOG_LEVEL: Joi.string()
    .valid('fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent')
    .default('info'),
} satisfies Record<string, Joi.Schema>;

export function createLoggingConfig(environment: Record<string, unknown>): LoggingConfig {
  return { level: readString(environment, 'LOG_LEVEL') as LogLevel };
}
