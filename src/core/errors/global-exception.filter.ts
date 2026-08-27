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
import { SentryExceptionCaptured } from '@sentry/nestjs';
import { I18nService } from 'nestjs-i18n';
import { QueryFailedError } from 'typeorm';

import { isPlainRecord } from '@/shared/helpers/is-plain-record';
import { projectSafeError } from '@/common/logging/safe-error';

import { ERROR_DEFINITIONS, type ErrorCode, isErrorCode } from './error-definitions';
import type { ErrorResponse } from './error-response.interface';

@Catch()
@Injectable()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  public constructor(private readonly i18n: I18nService) {}

  @SentryExceptionCaptured()
  public catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const request = context.getRequest<Request>();
    const response = context.getResponse<Response>();
    const resolved = this.resolveException(exception);
    const definition = ERROR_DEFINITIONS[resolved.code];
    const requestId =
      request.requestId ?? response.getHeader('x-request-id')?.toString() ?? 'unavailable';
    const correlationId =
      request.correlationId ?? response.getHeader('x-correlation-id')?.toString() ?? requestId;
    const language = request.i18nLang ?? 'en';
    const translated = this.i18n.translate(definition.messageKey, {
      lang: language,
      defaultValue: definition.fallbackMessage,
    });
    const message = typeof translated === 'string' ? translated : definition.fallbackMessage;
    const body: ErrorResponse = {
      statusCode: resolved.status,
      code: resolved.code,
      message,
      timestamp: new Date().toISOString(),
      path: request.originalUrl,
      requestId,
      correlationId,
      ...(resolved.code === 'INTERNAL_SERVER_ERROR' || resolved.details === undefined
        ? {}
        : { details: resolved.details }),
    };

    response.setHeader('Content-Language', language);
    if (resolved.status >= 500) {
      this.logger.error(
        {
          ...projectSafeError(exception),
          requestId,
          correlationId,
          method: request.method,
          path: request.originalUrl,
        },
        'Unhandled request failure',
      );
    }
    response.status(resolved.status).json(body);
  }

  private resolveException(exception: unknown): {
    code: ErrorCode;
    status: number;
    details?: unknown;
  } {
    if (exception instanceof QueryFailedError) {
      const driverError = exception.driverError as unknown;
      const databaseCode =
        typeof driverError === 'object' && driverError !== null
          ? (driverError as { code?: unknown }).code
          : undefined;
      if (databaseCode === '23503' || databaseCode === '23505' || databaseCode === '23514') {
        return { code: 'RESOURCE_CONFLICT', status: HttpStatus.CONFLICT };
      }
      return { code: 'INTERNAL_SERVER_ERROR', status: HttpStatus.INTERNAL_SERVER_ERROR };
    }
    if (!(exception instanceof HttpException)) {
      return { code: 'INTERNAL_SERVER_ERROR', status: HttpStatus.INTERNAL_SERVER_ERROR };
    }

    const status = exception.getStatus();
    const payload = exception.getResponse();
    if (isPlainRecord(payload) && isErrorCode(payload['code'])) {
      const code = status === 500 ? 'INTERNAL_SERVER_ERROR' : payload['code'];
      return {
        code,
        status,
        ...(payload['details'] === undefined ? {} : { details: payload['details'] }),
      };
    }

    const code = this.codeForStatus(status);
    const details = this.validationDetails(payload);
    return { code, status, ...(details === undefined ? {} : { details }) };
  }

  private validationDetails(payload: object | string): unknown {
    if (!isPlainRecord(payload) || !Array.isArray(payload['message'])) {
      return undefined;
    }
    const messages = payload['message'].filter(
      (value): value is string => typeof value === 'string',
    );
    return messages.length === 0 ? undefined : { fields: { _request: messages } };
  }

  private codeForStatus(status: number): ErrorCode {
    switch (status) {
      case 400:
        return 'BAD_REQUEST';
      case 422:
        return 'VALIDATION_ERROR';
      case 404:
        return 'RESOURCE_NOT_FOUND';
      case 409:
        return 'RESOURCE_CONFLICT';
      case 401:
        return 'UNAUTHORIZED';
      case 403:
        return 'FORBIDDEN';
      case 429:
        return 'TOO_MANY_REQUESTS';
      case 503:
        return 'SERVICE_NOT_READY';
      default:
        return status >= 500 ? 'INTERNAL_SERVER_ERROR' : 'BAD_REQUEST';
    }
  }
}
