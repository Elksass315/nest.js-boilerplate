import { CallHandler, ExecutionContext, Injectable, type NestInterceptor } from '@nestjs/common';
import type { Request, Response } from 'express';
import { map, type Observable } from 'rxjs';

import { RequestContextService } from '@/core/request-context/request-context.service';

import type { ApiSuccessResponse } from './api-response.types';

@Injectable()
export class ApiResponseInterceptor implements NestInterceptor {
  public constructor(private readonly requestContext: RequestContextService) {}

  public intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();

    return next.handle().pipe(
      map((data: unknown): unknown => {
        if (this.shouldPreserveResponse(request, response)) return data;

        const requestId =
          this.requestContext.getRequestId() ??
          request.requestId ??
          response.getHeader('x-request-id')?.toString() ??
          'unavailable';
        const correlationId =
          this.requestContext.getCorrelationId() ??
          request.correlationId ??
          response.getHeader('x-correlation-id')?.toString() ??
          requestId;

        const result: ApiSuccessResponse<unknown> = {
          success: true,
          meta: { requestId, correlationId, timestamp: new Date().toISOString() },
          data: data ?? {},
        };
        return result;
      }),
    );
  }

  private shouldPreserveResponse(request: Request, response: Response): boolean {
    if (request.method === 'HEAD' || response.statusCode === 204 || response.headersSent) {
      return true;
    }
    const contentType = response.getHeader('content-type')?.toString();
    return contentType !== undefined && !contentType.toLowerCase().includes('json');
  }
}
