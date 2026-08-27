import { ERROR_DEFINITIONS, type ErrorCode } from '@/core/errors/error-definitions';

export type SwaggerErrorContent = Record<'application/json', { example: Record<string, unknown> }>;

export function swaggerErrorExample(
  code: ErrorCode,
  path: string,
  details?: Record<string, unknown>,
): Record<string, unknown> {
  const definition = ERROR_DEFINITIONS[code];
  return {
    statusCode: definition.status,
    code,
    message: definition.fallbackMessage,
    timestamp: '2026-08-12T12:00:00.000Z',
    path,
    requestId: 'req_swagger_example',
    correlationId: 'corr_swagger_example',
    ...(details ? { details } : {}),
  };
}

export function swaggerErrorContent(
  code: ErrorCode,
  path: string,
  details?: Record<string, unknown>,
): SwaggerErrorContent {
  return {
    'application/json': { example: swaggerErrorExample(code, path, details) },
  };
}
