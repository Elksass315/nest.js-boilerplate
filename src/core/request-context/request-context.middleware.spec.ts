import type { NextFunction, Request, Response } from 'express';
import type { ConfigService } from '@nestjs/config';

import type { AppConfiguration } from '@/config/configuration.types';

import { RequestContextMiddleware } from './request-context.middleware';
import type { RequestContextService } from './request-context.service';

describe(RequestContextMiddleware.name, () => {
  const config = {
    getOrThrow: jest.fn((key: string): string | string[] =>
      key === 'i18n.supportedLanguages' ? ['en'] : 'en',
    ),
  } as unknown as ConfigService<AppConfiguration, true>;

  it('propagates request and correlation IDs into headers and async context', () => {
    const run = jest.fn((_context: unknown, callback: () => void): void => {
      callback();
    });
    const context = { run } as unknown as RequestContextService;
    const request = { id: 'request-1', correlationId: 'workflow-1' } as Request;
    const response = { setHeader: jest.fn() } as unknown as Response;
    const next = jest.fn() as NextFunction;

    new RequestContextMiddleware(context, config).use(request, response, next);

    expect(request.requestId).toBe('request-1');
    expect(response.setHeader).toHaveBeenCalledWith('x-request-id', 'request-1');
    expect(response.setHeader).toHaveBeenCalledWith('x-correlation-id', 'workflow-1');
    expect(response.setHeader).toHaveBeenCalledWith('Content-Language', 'en');
    expect(run).toHaveBeenCalledWith({ requestId: 'request-1', correlationId: 'workflow-1' }, next);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('uses the request ID as the correlation fallback', () => {
    const run = jest.fn();
    const request = { id: 42 } as Request;

    new RequestContextMiddleware({ run } as unknown as RequestContextService, config).use(
      request,
      { setHeader: jest.fn() } as unknown as Response,
      jest.fn(),
    );

    expect(run).toHaveBeenCalledWith(
      { requestId: '42', correlationId: '42' },
      expect.any(Function),
    );
  });

  it('falls back from unsupported requested languages', () => {
    const request = { id: 'request-3', i18nLang: 'ar' } as Request;

    new RequestContextMiddleware(
      { run: jest.fn() } as unknown as RequestContextService,
      config,
    ).use(request, { setHeader: jest.fn() } as unknown as Response, jest.fn());

    expect(request.i18nLang).toBe('en');
  });
});
