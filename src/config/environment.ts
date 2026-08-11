import Joi from 'joi';

export interface EnvironmentVariables {
  NODE_ENV: 'development' | 'test' | 'staging' | 'production';
  APP_PORT: number;
  API_PREFIX: string;
  API_VERSION: string;
  CORS_ORIGINS: string;
  LOG_LEVEL: string;
  SWAGGER_ENABLED: boolean;
  DATABASE_HOST: string;
  DATABASE_PORT: number;
  DATABASE_NAME: string;
  DATABASE_USERNAME: string;
  DATABASE_PASSWORD: string;
  DATABASE_SSL_ENABLED: boolean;
  DATABASE_REJECT_UNAUTHORIZED: boolean;
  DATABASE_POOL_SIZE: number;
  DATABASE_CONNECT_TIMEOUT_MS: number;
  REDIS_HOST: string;
  REDIS_PORT: number;
  REDIS_PASSWORD: string;
  REDIS_DB: number;
  REDIS_CONNECT_TIMEOUT_MS: number;
  RATE_LIMIT_TTL_MS: number;
  RATE_LIMIT_MAX: number;
}

const environmentSchema = Joi.object<EnvironmentVariables>({
  NODE_ENV: Joi.string()
    .valid('development', 'test', 'staging', 'production')
    .default('development'),
  APP_PORT: Joi.number().port().default(3000),
  API_PREFIX: Joi.string()
    .pattern(/^[a-z][a-z0-9-]*$/)
    .default('api'),
  API_VERSION: Joi.string().pattern(/^\d+$/).default('1'),
  CORS_ORIGINS: Joi.string().default('http://localhost:3000'),
  LOG_LEVEL: Joi.string()
    .valid('fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent')
    .default('info'),
  SWAGGER_ENABLED: Joi.boolean().truthy('true').falsy('false').default(true),
  DATABASE_HOST: Joi.string().hostname().required(),
  DATABASE_PORT: Joi.number().port().default(5432),
  DATABASE_NAME: Joi.string()
    .pattern(/^[a-zA-Z0-9_-]+$/)
    .required(),
  DATABASE_USERNAME: Joi.string().required(),
  DATABASE_PASSWORD: Joi.string().min(12).required(),
  DATABASE_SSL_ENABLED: Joi.boolean().truthy('true').falsy('false').default(false),
  DATABASE_REJECT_UNAUTHORIZED: Joi.boolean().truthy('true').falsy('false').default(true),
  DATABASE_POOL_SIZE: Joi.number().integer().min(1).max(100).default(20),
  DATABASE_CONNECT_TIMEOUT_MS: Joi.number().integer().min(500).max(60000).default(5000),
  REDIS_HOST: Joi.string().hostname().required(),
  REDIS_PORT: Joi.number().port().default(6379),
  REDIS_PASSWORD: Joi.string().allow('').default(''),
  REDIS_DB: Joi.number().integer().min(0).max(15).default(0),
  REDIS_CONNECT_TIMEOUT_MS: Joi.number().integer().min(500).max(60000).default(5000),
  RATE_LIMIT_TTL_MS: Joi.number().integer().min(1000).default(60000),
  RATE_LIMIT_MAX: Joi.number().integer().min(1).default(100),
})
  .custom((environment: EnvironmentVariables, helpers: Joi.CustomHelpers) => {
    const isManagedEnvironment =
      environment.NODE_ENV === 'staging' || environment.NODE_ENV === 'production';

    if (environment.NODE_ENV === 'production' && environment.SWAGGER_ENABLED) {
      return helpers.error('environment.swaggerProduction');
    }

    if (isManagedEnvironment && environment.REDIS_PASSWORD.length < 16) {
      return helpers.error('environment.redisPassword');
    }

    return environment;
  })
  .messages({
    'environment.redisPassword':
      'REDIS_PASSWORD must contain at least 16 characters in staging and production',
    'environment.swaggerProduction': 'SWAGGER_ENABLED must be false in production',
  });

export function validateEnvironment(input: Record<string, unknown>): EnvironmentVariables {
  const result: Joi.ValidationResult<EnvironmentVariables> = environmentSchema.validate(input, {
    abortEarly: false,
    allowUnknown: true,
    convert: true,
    stripUnknown: true,
  });

  if (result.error) {
    throw new Error(`Environment validation failed: ${result.error.message}`);
  }

  return result.value;
}

export function parseCorsOrigins(value: string): string[] {
  return value
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);
}
