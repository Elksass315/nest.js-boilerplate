import { Injectable, type NestMiddleware } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { NextFunction, Request, Response } from 'express';

import type { AppConfiguration } from '@/config/configuration.types';

import { RequestContextService } from './request-context.service';

@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  public constructor(
    private readonly context: RequestContextService,
    private readonly config: ConfigService<AppConfiguration, true>,
  ) {}

  public use(request: Request, response: Response, next: NextFunction): void {
    const requestId =
      typeof request.id === 'string' || typeof request.id === 'number'
        ? request.id.toString()
        : JSON.stringify(request.id);
    const correlationId = request.correlationId ?? requestId;
    request.requestId = requestId;
    request.correlationId = correlationId;
    const supportedLanguages = this.config.getOrThrow('i18n.supportedLanguages', { infer: true });
    const language =
      request.i18nLang && supportedLanguages.includes(request.i18nLang)
        ? request.i18nLang
        : this.config.getOrThrow('i18n.fallbackLanguage', { infer: true });
    request.i18nLang = language;
    response.setHeader('x-request-id', requestId);
    response.setHeader('x-correlation-id', correlationId);
    response.setHeader('Content-Language', language);
    this.context.run({ requestId, correlationId }, next);
  }
}
