import {
  BadRequestException,
  HttpException,
  HttpStatus,
  InternalServerErrorException,
  Logger,
  type ArgumentsHost,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import type { I18nService } from 'nestjs-i18n';
import { QueryFailedError } from 'typeorm';

import { AppException } from './app.exception';
import { GlobalExceptionFilter } from './global-exception.filter';

describe(GlobalExceptionFilter.name, () => {
  const i18n = {
    translate: jest.fn(
      (_key: string, options: { defaultValue: string }): string => options.defaultValue,
    ),
  } as unknown as I18nService;

  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  function createHost(): {
    host: ArgumentsHost;
    json: jest.Mock;
    status: jest.Mock;
    setHeader: jest.Mock;
  } {
    const json = jest.fn();
    const status = jest.fn().mockReturnValue({ json });
    const setHeader = jest.fn();
    const request = {
      method: 'POST',
      originalUrl: '/api/v1/test',
      requestId: 'request-1',
      correlationId: 'correlation-1',
      i18nLang: 'en',
    } as Request;
    const response = { getHeader: jest.fn(), setHeader, status } as unknown as Response;
    const host = {
      switchToHttp: (): {
        getRequest: () => Request;
        getResponse: () => Response;
      } => ({
        getRequest: (): Request => request,
        getResponse: (): Response => response,
      }),
    } as ArgumentsHost;
    return { host, json, status, setHeader };
  }

  it('renders a registered application exception', () => {
    const { host, json, status } = createHost();
    new GlobalExceptionFilter(i18n).catch(
      new AppException('VALIDATION_ERROR', { fields: { name: ['name is required'] } }),
      host,
    );
    expect(status).toHaveBeenCalledWith(422);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'VALIDATION_ERROR',
        message: 'Input validation failed',
        requestId: 'request-1',
        correlationId: 'correlation-1',
      }),
    );
  });

  it('maps Nest validation errors to safe structured details', () => {
    const { host, json } = createHost();
    new GlobalExceptionFilter(i18n).catch(new BadRequestException(['invalid']), host);
    expect(json).toHaveBeenCalledWith(expect.objectContaining({ code: 'BAD_REQUEST' }));
  });

  it('hides unhandled exception details', () => {
    const { host, json } = createHost();
    new GlobalExceptionFilter(i18n).catch(new InternalServerErrorException('secret'), host);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Internal server error',
      }),
    );
    expect(json.mock.calls[0]?.[0]).not.toHaveProperty('details');
  });

  it('returns the standard safe response for unknown failures', () => {
    const { host, json } = createHost();

    new GlobalExceptionFilter(i18n).catch(new Error('database password leaked'), host);

    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 500,
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Internal server error',
      }),
    );
    expect(json.mock.calls[0]?.[0]).not.toHaveProperty('details');
  });

  it('normalizes every HTTP 500 payload to the internal error contract', () => {
    const { host, json } = createHost();

    new GlobalExceptionFilter(i18n).catch(
      new HttpException(
        { code: 'RESOURCE_CONFLICT', details: { secret: 'hidden' } },
        HttpStatus.INTERNAL_SERVER_ERROR,
      ),
      host,
    );

    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 500,
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Internal server error',
      }),
    );
    expect(json.mock.calls[0]?.[0]).not.toHaveProperty('details');
  });

  it.each([
    [401, 'UNAUTHORIZED'],
    [403, 'FORBIDDEN'],
    [404, 'RESOURCE_NOT_FOUND'],
    [409, 'RESOURCE_CONFLICT'],
    [429, 'TOO_MANY_REQUESTS'],
    [503, 'SERVICE_NOT_READY'],
  ] as const)('maps HTTP %i to the registered %s code', (httpStatus, code) => {
    const { host, json } = createHost();

    new GlobalExceptionFilter(i18n).catch(new HttpException('safe mapping', httpStatus), host);

    expect(json).toHaveBeenCalledWith(expect.objectContaining({ statusCode: httpStatus, code }));
  });

  it('maps known PostgreSQL constraint errors to a conflict', () => {
    const { host, json } = createHost();
    const driverError = Object.assign(new Error('duplicate'), { code: '23505' });

    new GlobalExceptionFilter(i18n).catch(
      new QueryFailedError('INSERT INTO users', [], driverError),
      host,
    );

    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 409, code: 'RESOURCE_CONFLICT' }),
    );
  });

  it('hides unknown database failures behind the internal error contract', () => {
    const { host, json } = createHost();

    new GlobalExceptionFilter(i18n).catch(
      new QueryFailedError('SELECT secret', [], new Error('connection details')),
      host,
    );

    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 500, code: 'INTERNAL_SERVER_ERROR' }),
    );
  });

  it('logs only a safe database projection', () => {
    const { host } = createHost();
    const error = new QueryFailedError(
      'SELECT password FROM users WHERE id = $1',
      ['secret'],
      Object.assign(new Error('password=secret'), { code: '99999', constraint: 'users_email_key' }),
    );

    new GlobalExceptionFilter(i18n).catch(error, host);

    expect(Logger.prototype.error).toHaveBeenCalledWith(
      expect.objectContaining({
        errorType: 'QueryFailedError',
        requestId: 'request-1',
        correlationId: 'correlation-1',
      }),
      'Unhandled request failure',
    );
    expect(Logger.prototype.error).not.toHaveBeenCalledWith(
      expect.objectContaining({ exception: expect.anything() }),
      expect.anything(),
    );
  });
});
