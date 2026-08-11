import type { DatabaseConfig } from '@/database/config/database.config';
import type { RedisConfig } from '@/redis/config/redis.config';

export type NodeEnvironment = 'development' | 'test' | 'staging' | 'production';
export type LogLevel = 'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'trace' | 'silent';
export type SwaggerDocsAccess = 'public' | 'basic' | 'disabled';

export interface AppConfig {
  nodeEnv: NodeEnvironment;
  name: string;
  port: number;
  apiPrefix: string;
}

export interface CorsConfig {
  origins: string[];
}

export interface LoggingConfig {
  level: LogLevel;
}

export interface SwaggerConfig {
  access: SwaggerDocsAccess;
  username: string;
  password: string;
}

export interface RateLimitConfig {
  ttlMs: number;
  max: number;
}

export interface I18nConfig {
  fallbackLanguage: string;
  supportedLanguages: string[];
  headerLanguage: string;
}

export interface AppConfiguration {
  app: AppConfig;
  cors: CorsConfig;
  logging: LoggingConfig;
  swagger: SwaggerConfig;
  rateLimit: RateLimitConfig;
  i18n: I18nConfig;
  database: DatabaseConfig;
  redis: RedisConfig;
}
