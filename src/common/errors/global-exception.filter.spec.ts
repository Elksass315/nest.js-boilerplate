import {
  BadRequestException,
  HttpException,
  InternalServerErrorException,
  type ArgumentsHost,
} from '@nestjs/common';
import type { Request, Response } from 'express';

import { GlobalExceptionFilter } from './global-exception.filter';

describe(GlobalExceptionFilter.name, () => {
  function createHost(): {
    host: ArgumentsHost;
    json: jest.Mock;
    status: jest.Mock;
  } {
    const json = jest.fn();
    const status = jest.fn().mockReturnValue({ json });
    const request = { method: 'POST', originalUrl: '/api/v1/test' } as Request;
    const response = {
      getHeader: jest.fn().mockReturnValue('request-1'),
      status,
    } as unknown as Response;
    const host = {
      switchToHttp: () => ({
        getRequest: (): Request => request,
        getResponse: (): Response => response,
      }),
    } as ArgumentsHost;

    return { host, json, status };
  }

  it('normalizes an HTTP exception', () => {
    const { host, json, status } = createHost();

    new GlobalExceptionFilter().catch(
      new BadRequestException({ code: 'INVALID_INPUT', message: ['name is required'] }),
      host,
    );

    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'INVALID_INPUT',
        message: ['name is required'],
        path: '/api/v1/test',
        requestId: 'request-1',
      }),
    );
  });

  it('normalizes a string HTTP exception with a default code', () => {
    const { host, json } = createHost();

    new GlobalExceptionFilter().catch(new HttpException('Not available', 409), host);

    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'HTTP_409', message: 'Not available' }),
    );
  });

  it('uses a safe message for malformed exception content', () => {
    const { host, json } = createHost();

    new GlobalExceptionFilter().catch(new BadRequestException({ message: [1, 2] }), host);

    expect(json).toHaveBeenCalledWith(expect.objectContaining({ message: 'Request failed' }));
  });

  it('hides unhandled exception details', () => {
    const { host, json, status } = createHost();

    new GlobalExceptionFilter().catch(new InternalServerErrorException(), host);

    expect(status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Internal Server Error',
      }),
    );
  });

  it('normalizes a non-HTTP error without exposing it', () => {
    const { host, json } = createHost();

    new GlobalExceptionFilter().catch(new Error('secret implementation detail'), host);

    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Internal server error',
      }),
    );
  });
});
