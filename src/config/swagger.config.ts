import Joi from 'joi';

import type { SwaggerConfig, SwaggerDocsAccess } from './configuration.types';
import { readString } from './environment-reader';

export const swaggerEnvironmentSchema = {
  SWAGGER_DOCS_ACCESS: Joi.string().valid('public', 'basic', 'disabled').default('disabled'),
  SWAGGER_DOCS_USERNAME: Joi.string().trim().allow('').default(''),
  SWAGGER_DOCS_PASSWORD: Joi.string().allow('').default(''),
} satisfies Record<string, Joi.Schema>;

export function createSwaggerConfig(environment: Record<string, unknown>): SwaggerConfig {
  return {
    access: readString(environment, 'SWAGGER_DOCS_ACCESS') as SwaggerDocsAccess,
    username: readString(environment, 'SWAGGER_DOCS_USERNAME'),
    password: readString(environment, 'SWAGGER_DOCS_PASSWORD'),
  };
}
