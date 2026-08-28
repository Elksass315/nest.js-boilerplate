import { Global, MiddlewareConsumer, Module, type NestModule, RequestMethod } from '@nestjs/common';

import { RequestContextMiddleware } from './request-context/request-context.middleware';
import { RequestContextService } from './request-context/request-context.service';
import { WorkerHeartbeatService } from './worker/worker-heartbeat.service';

@Global()
@Module({
  providers: [RequestContextService, RequestContextMiddleware, WorkerHeartbeatService],
  exports: [RequestContextService, WorkerHeartbeatService],
})
export class CoreModule implements NestModule {
  public configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(RequestContextMiddleware)
      .forRoutes({ path: '*path', method: RequestMethod.ALL });
  }
}
