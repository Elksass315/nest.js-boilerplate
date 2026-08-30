import { Global, MiddlewareConsumer, Module, type NestModule, RequestMethod } from '@nestjs/common';

import { RequestContextMiddleware } from './request-context/request-context.middleware';
import { RequestContextService } from './request-context/request-context.service';
import { WorkerHeartbeatService } from './worker/worker-heartbeat.service';
import { OperationalMetricsService } from '@/observability/operational-metrics';
import { HttpMetricsInterceptor } from '@/observability/http-metrics.interceptor';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { ERROR_REPORTER, NoopErrorReporter } from './error-reporting/error-reporter';

@Global()
@Module({
  providers: [
    RequestContextService,
    RequestContextMiddleware,
    WorkerHeartbeatService,
    OperationalMetricsService,
    { provide: ERROR_REPORTER, useClass: NoopErrorReporter },
    { provide: APP_INTERCEPTOR, useClass: HttpMetricsInterceptor },
  ],
  exports: [
    RequestContextService,
    WorkerHeartbeatService,
    OperationalMetricsService,
    ERROR_REPORTER,
  ],
})
export class CoreModule implements NestModule {
  public configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(RequestContextMiddleware)
      .forRoutes({ path: '*path', method: RequestMethod.ALL });
  }
}
