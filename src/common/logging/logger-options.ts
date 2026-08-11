import { randomUUID } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';

import type { Params } from 'nestjs-pino';

const REQUEST_ID_HEADER = 'x-request-id';
const MAX_REQUEST_ID_LENGTH = 128;

function getIncomingRequestId(request: IncomingMessage): string | undefined {
  const value = request.headers[REQUEST_ID_HEADER];
  const candidate = Array.isArray(value) ? value[0] : value;

  if (!candidate || candidate.length > MAX_REQUEST_ID_LENGTH) {
    return undefined;
  }

  return /^[a-zA-Z0-9._:-]+$/.test(candidate) ? candidate : undefined;
}

export function createLoggerOptions(logLevel: string): Params {
  return {
    pinoHttp: {
      level: logLevel,
      genReqId: createRequestId,
      customProps: (request: IncomingMessage): { requestId: string } => ({
        requestId:
          typeof request.id === 'string' || typeof request.id === 'number'
            ? request.id.toString()
            : JSON.stringify(request.id),
      }),
      redact: {
        paths: [
          'req.headers.authorization',
          'req.headers.cookie',
          'req.body.password',
          'req.body.token',
          'req.body.accessToken',
          'req.body.refreshToken',
          'res.headers.set-cookie',
        ],
        censor: '[REDACTED]',
      },
      autoLogging: {
        ignore: (request: IncomingMessage) => request.url === '/health/live',
      },
      serializers: {
        req: (request: { id?: string; method?: string; url?: string }) => ({
          id: request.id,
          method: request.method,
          url: request.url,
        }),
        res: (response: { statusCode?: number }) => ({ statusCode: response.statusCode }),
      },
    },
  };
}

export function createRequestId(request: IncomingMessage, response: ServerResponse): string {
  const requestId = getIncomingRequestId(request) ?? randomUUID();
  response.setHeader(REQUEST_ID_HEADER, requestId);
  return requestId;
}
