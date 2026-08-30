import { CallHandler, ExecutionContext, Injectable, type NestInterceptor } from '@nestjs/common';
import { Observable, tap } from 'rxjs';

import { OperationalMetricsService } from './operational-metrics';

interface RequestWithRoute {
  route?: { path?: string };
  url?: string;
}

interface ResponseWithStatus {
  statusCode?: number;
}

@Injectable()
export class HttpMetricsInterceptor implements NestInterceptor {
  public constructor(private readonly metrics: OperationalMetricsService) {}

  public intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<RequestWithRoute>();
    const response = context.switchToHttp().getResponse<ResponseWithStatus>();
    const startedAt = performance.now();
    const route = request.route?.path ?? request.url ?? '/unknown';
    return next.handle().pipe(
      tap({
        next: () => {
          this.metrics.recordRequest(
            route,
            response.statusCode ?? 200,
            performance.now() - startedAt,
          );
        },
        error: () => {
          this.metrics.recordRequest(
            route,
            response.statusCode ?? 500,
            performance.now() - startedAt,
          );
        },
      }),
    );
  }
}
