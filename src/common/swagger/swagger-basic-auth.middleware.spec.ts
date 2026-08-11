import type { NextFunction, Request, Response } from 'express';

import { createSwaggerBasicAuthMiddleware } from './swagger-basic-auth.middleware';

function createResponse(): Response {
  return {
    getHeader: jest.fn().mockReturnValue('request-1'),
    json: jest.fn().mockReturnThis(),
    setHeader: jest.fn(),
    status: jest.fn().mockReturnThis(),
  } as unknown as Response;
}

describe(createSwaggerBasicAuthMiddleware.name, () => {
  const middleware = createSwaggerBasicAuthMiddleware('docs-user', 'strong-docs-password');

  it('accepts matching basic credentials', () => {
    const request = {
      header: jest
        .fn()
        .mockReturnValue(
          `Basic ${Buffer.from('docs-user:strong-docs-password').toString('base64')}`,
        ),
    } as unknown as Request;
    const response = createResponse();
    const next = jest.fn() as NextFunction;

    middleware(request, response, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(response.status).not.toHaveBeenCalled();
  });

  it.each([undefined, 'Bearer token', 'Basic invalid-base64'])(
    'rejects missing or malformed credentials: %s',
    (authorization) => {
      const request = {
        header: jest.fn().mockReturnValue(authorization),
        originalUrl: '/docs',
      } as unknown as Request;
      const response = createResponse();
      const next = jest.fn() as NextFunction;

      middleware(request, response, next);

      expect(next).not.toHaveBeenCalled();
      expect(response.setHeader).toHaveBeenCalledWith(
        'WWW-Authenticate',
        'Basic realm="API documentation", charset="UTF-8"',
      );
      expect(response.status).toHaveBeenCalledWith(401);
      expect(response.json).toHaveBeenCalledWith({
        statusCode: 401,
        code: 'SWAGGER_AUTH_REQUIRED',
        message: 'Valid credentials are required to access API documentation',
        timestamp: expect.any(String),
        path: '/docs',
        requestId: 'request-1',
      });
    },
  );
});
