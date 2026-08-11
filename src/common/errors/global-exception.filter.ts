import {
  ArgumentsHost,
  Catch,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  type ExceptionFilter,
} from '@nestjs/common';
import type { Request, Response } from 'express';

import type { ErrorResponse } from './error-response.interface';

interface StructuredHttpError {
  code?: unknown;
  details?: unknown;
  message?: unknown;
}

@Catch()
@Injectable()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  public catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const request = context.getRequest<Request>();
    const response = context.getResponse<Response>();
    const statusCode =
      exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const exceptionResponse =
      exception instanceof HttpException ? exception.getResponse() : 'Internal server error';
    const structured = this.toStructuredError(exceptionResponse);
    const requestId = response.getHeader('x-request-id')?.toString() ?? 'unavailable';
    const errorResponse: ErrorResponse = {
      statusCode,
      code: typeof structured.code === 'string' ? structured.code : this.defaultCode(statusCode),
      message: this.toMessage(structured.message),
      timestamp: new Date().toISOString(),
      path: request.originalUrl,
      requestId,
      ...(structured.details === undefined ? {} : { details: structured.details }),
    };

    if (statusCode >= 500) {
      this.logger.error(
        { exception, requestId, method: request.method, path: request.originalUrl },
        'Unhandled request failure',
      );
    }

    response.status(statusCode).json(errorResponse);
  }

  private toStructuredError(response: object | string): StructuredHttpError {
    return typeof response === 'string' ? { message: response } : response;
  }

  private toMessage(message: unknown): string | string[] {
    if (typeof message === 'string') {
      return message;
    }

    if (Array.isArray(message) && message.every((value) => typeof value === 'string')) {
      return message;
    }

    return 'Request failed';
  }

  private defaultCode(statusCode: number): string {
    if (statusCode === 500) {
      return 'INTERNAL_SERVER_ERROR';
    }

    return `HTTP_${statusCode.toString()}`;
  }
}
