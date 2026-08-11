import { randomUUID } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';

import type { Params } from 'nestjs-pino';

const REQUEST_ID_HEADER = 'x-request-id';
const CORRELATION_ID_HEADER = 'x-correlation-id';
const MAX_REQUEST_ID_LENGTH = 128;

interface ContextIncomingMessage extends IncomingMessage {
  correlationId?: string;
}

function getIncomingIdentifier(request: IncomingMessage, header: string): string | undefined {
  const value = request.headers[header];
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
      customProps: (
        request: ContextIncomingMessage,
      ): {
        requestId: string;
        correlationId: string;
      } => ({
        requestId:
          typeof request.id === 'string' || typeof request.id === 'number'
            ? request.id.toString()
            : JSON.stringify(request.id),
        correlationId:
          request.correlationId ??
          (typeof request.id === 'string' || typeof request.id === 'number'
            ? request.id.toString()
            : JSON.stringify(request.id)),
      }),
      redact: {
        paths: [
          'req.headers.authorization',
          'req.headers.cookie',
          'req.body.password',
          'req.body.token',
          'req.body.accessToken',
          'req.body.refreshToken',
          'req.body.code',
          'req.body.recoveryCode',
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
  const requestId = getIncomingIdentifier(request, REQUEST_ID_HEADER) ?? randomUUID();
  const correlationId = getIncomingIdentifier(request, CORRELATION_ID_HEADER) ?? requestId;
  (request as ContextIncomingMessage).correlationId = correlationId;
  response.setHeader(REQUEST_ID_HEADER, requestId);
  response.setHeader(CORRELATION_ID_HEADER, correlationId);
  return requestId;
}
