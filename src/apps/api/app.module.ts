import { ExecutionContext, Module } from '@nestjs/common';
import { SentryModule } from '@sentry/nestjs/setup';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';

import { createLoggerOptions } from '@/common/logging/logger-options';
import {
  createIdentifierThrottleTracker,
  createIpThrottleTracker,
} from '@/common/http/throttle-tracker';
import type { AppConfiguration } from '@/config/configuration.types';
import { loadApiConfiguration } from '@/config/environment';
import { CoreModule } from '@/core/core.module';
import { GlobalExceptionFilter } from '@/core/errors/global-exception.filter';
import { AppI18nModule } from '@/core/i18n/i18n.module';
import { DatabaseModule } from '@/database/database.module';
import { HealthModule } from '@/health/health.module';
import { AuthorizationModule } from '@/modules/authorization';
import { AuthModule } from '@/modules/auth';
import { FeatureFlagsModule } from '@/modules/feature-flags';
import { FilesModule } from '@/modules/files';
import { InvitationsModule } from '@/modules/invitations';
import { UsersModule } from '@/modules/users';
import { RedisModule } from '@/redis/redis.module';
import { DistributedThrottlerStorage } from '@/redis/distributed-throttler.storage';
import { REDIS_CLIENT } from '@/redis/redis.constants';
import type Redis from 'ioredis';
import { OutboxModule } from '@/core/outbox/outbox.module';

@Module({
  imports: [
    SentryModule.forRoot(),
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      expandVariables: false,
      load: [loadApiConfiguration],
    }),
    LoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<AppConfiguration, true>) =>
        createLoggerOptions(config.getOrThrow('logging.level', { infer: true })),
    }),
    ThrottlerModule.forRootAsync({
      inject: [ConfigService, REDIS_CLIENT],
      useFactory: (config: ConfigService<AppConfiguration, true>, redis: Redis) => {
        const limits = config.getOrThrow('rateLimit', { infer: true });
        return {
          storage: new DistributedThrottlerStorage(redis),
          throttlers: [
            { name: 'global', ttl: limits.global.ttlMs, limit: limits.global.max },
            ...sensitiveThrottlePair('authentication', limits.authentication),
            ...sensitiveThrottlePair('otp', limits.otp),
            ...sensitiveThrottlePair('recovery', limits.recovery),
            ...sensitiveThrottlePair('emailDelivery', limits.emailDelivery),
          ],
        };
      },
    }),
    AppI18nModule,
    CoreModule,
    DatabaseModule,
    RedisModule,
    OutboxModule,
    HealthModule,
    AuthorizationModule,
    UsersModule,
    AuthModule,
    FilesModule,
    FeatureFlagsModule,
    InvitationsModule,
  ],
  providers: [
    { provide: APP_FILTER, useClass: GlobalExceptionFilter },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}

function sensitiveThrottlePair(
  name: string,
  policy: { ttlMs: number; max: number },
): {
  name: string;
  ttl: number;
  limit: number;
  getTracker: (request: Parameters<typeof createIpThrottleTracker>[0]) => string;
  skipIf: (context: ExecutionContext) => boolean;
}[] {
  const skipIf = (context: ExecutionContext): boolean => !matchesThrottleRoute(context, name);
  return [
    {
      name: `${name}Ip`,
      ttl: policy.ttlMs,
      limit: policy.max,
      getTracker: createIpThrottleTracker,
      skipIf,
    },
    {
      name: `${name}Identifier`,
      ttl: policy.ttlMs,
      limit: policy.max,
      getTracker: createIdentifierThrottleTracker,
      skipIf,
    },
  ];
}

function matchesThrottleRoute(
  context: { switchToHttp: () => { getRequest: () => { originalUrl?: string; url?: string } } },
  name: string,
): boolean {
  const request = context.switchToHttp().getRequest();
  const path = request.originalUrl ?? request.url ?? '';
  const routes: Record<string, RegExp> = {
    authentication: /\/auth\/(?:register|login|refresh)(?:[/?]|$)/,
    otp: /\/auth\/(?:verification|two-step)(?:[/?]|$)/,
    recovery: /\/auth\/(?:forgot-password|reset-password|recovery)(?:[/?]|$)/,
    emailDelivery: /(?:\/auth\/(?:register|verification\/resend)|\/team\/invitations)(?:[/?]|$)/,
  };
  return routes[name]?.test(path) ?? false;
}
