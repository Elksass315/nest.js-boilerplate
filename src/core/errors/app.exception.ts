import { HttpException } from '@nestjs/common';

import { ERROR_DEFINITIONS, type ErrorCode } from './error-definitions';

interface AppErrorPayload {
  code: ErrorCode;
  details?: unknown;
}

export class AppException extends HttpException {
  public constructor(code: ErrorCode, details?: unknown) {
    const definition = ERROR_DEFINITIONS[code];
    const payload: AppErrorPayload = details === undefined ? { code } : { code, details };
    super(payload, definition.status);
  }
}
