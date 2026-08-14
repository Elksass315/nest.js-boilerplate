import { HttpStatus, type ValidationError, type ValidationPipeOptions } from '@nestjs/common';

import { AppException } from './app.exception';

function flattenValidationErrors(errors: ValidationError[], parent = ''): Record<string, string[]> {
  const fields: Record<string, string[]> = {};
  for (const error of errors) {
    const path = parent.length === 0 ? error.property : `${parent}.${error.property}`;
    const messages = Object.values(error.constraints ?? {});
    if (messages.length > 0) {
      fields[path] = messages;
    }
    Object.assign(fields, flattenValidationErrors(error.children ?? [], path));
  }
  return fields;
}

export const validationPipeOptions: ValidationPipeOptions = {
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
  transformOptions: { enableImplicitConversion: false },
  stopAtFirstError: false,
  errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY,
  exceptionFactory: (errors: ValidationError[]) =>
    new AppException('VALIDATION_ERROR', { fields: flattenValidationErrors(errors) }),
};
