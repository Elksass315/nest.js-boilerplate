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

export interface AuthConfig {
  accessTokenSecret: string;
  tokenIssuer: string;
  tokenAudience: string;
  accessTokenTtlSeconds: number;
  sessionTtlSeconds: number;
  verificationTokenTtlSeconds: number;
  passwordResetTokenTtlSeconds: number;
  maxActiveSessions: number;
  maxFailedLoginAttempts: number;
  loginLockSeconds: number;
}

export interface MailConfig {
  enabled: boolean;
  fromAddress: string;
  fromName: string;
  actionBaseUrl: string;
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  smtpUsername: string;
  smtpPassword: string;
  maxRetries: number;
  retryDelayMs: number;
  branding: {
    primaryColor: string;
    secondaryColor: string;
    logoUrl: string;
    companyName: string;
    supportEmail: string;
  };
}

export interface AppConfiguration {
  app: AppConfig;
  cors: CorsConfig;
  logging: LoggingConfig;
  swagger: SwaggerConfig;
  rateLimit: RateLimitConfig;
  i18n: I18nConfig;
  auth: AuthConfig;
  mail: MailConfig;
  database: DatabaseConfig;
  redis: RedisConfig;
}
