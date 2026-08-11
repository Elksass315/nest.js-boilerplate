import Joi from 'joi';

import type { CorsConfig } from './configuration.types';
import { readString } from './environment-reader';

export const corsEnvironmentSchema = {
  CORS_ORIGINS: Joi.string()
    .custom((value: string, helpers: Joi.CustomHelpers) => {
      const origins = parseCorsOrigins(value);
      if (origins.length === 0) {
        return helpers.error('environment.corsOrigins');
      }
      for (const origin of origins) {
        try {
          const url = new URL(origin);
          if (
            !['http:', 'https:'].includes(url.protocol) ||
            url.origin !== origin ||
            origin.includes('*')
          ) {
            return helpers.error('environment.corsOrigins');
          }
        } catch {
          return helpers.error('environment.corsOrigins');
        }
      }
      return value;
    })
    .default('http://localhost:3000'),
} satisfies Record<string, Joi.Schema>;

export function parseCorsOrigins(value: string): string[] {
  return value
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);
}

export function createCorsConfig(environment: Record<string, unknown>): CorsConfig {
  return { origins: parseCorsOrigins(readString(environment, 'CORS_ORIGINS')) };
}
