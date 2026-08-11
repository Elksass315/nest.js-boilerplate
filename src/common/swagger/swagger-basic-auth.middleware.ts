import { timingSafeEqual } from 'node:crypto';

import type { RequestHandler } from 'express';

const BASIC_AUTH_SCHEME = 'Basic ';

function safeEqual(actual: string, expected: string): boolean {
  const actualBuffer = Buffer.from(actual);
  const expectedBuffer = Buffer.from(expected);

  return (
    actualBuffer.length === expectedBuffer.length && timingSafeEqual(actualBuffer, expectedBuffer)
  );
}

export function createSwaggerBasicAuthMiddleware(
  expectedUsername: string,
  expectedPassword: string,
): RequestHandler {
  return (request, response, next): void => {
    const authorization = request.header('authorization');
    const encodedCredentials = authorization?.startsWith(BASIC_AUTH_SCHEME)
      ? authorization.slice(BASIC_AUTH_SCHEME.length)
      : undefined;
    const decodedCredentials = encodedCredentials
      ? Buffer.from(encodedCredentials, 'base64').toString('utf8')
      : '';
    const separatorIndex = decodedCredentials.indexOf(':');
    const username = separatorIndex >= 0 ? decodedCredentials.slice(0, separatorIndex) : '';
    const password = separatorIndex >= 0 ? decodedCredentials.slice(separatorIndex + 1) : '';

    if (safeEqual(username, expectedUsername) && safeEqual(password, expectedPassword)) {
      next();
      return;
    }

    response.setHeader('WWW-Authenticate', 'Basic realm="API documentation", charset="UTF-8"');
    response.status(401).json({
      statusCode: 401,
      code: 'SWAGGER_AUTH_REQUIRED',
      message: 'Valid credentials are required to access API documentation',
      timestamp: new Date().toISOString(),
      path: request.originalUrl,
      requestId: response.getHeader('x-request-id')?.toString() ?? 'unavailable',
    });
  };
}
