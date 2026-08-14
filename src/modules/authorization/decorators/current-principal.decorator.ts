import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';

export const CurrentPrincipal = createParamDecorator(
  (_data: unknown, context: ExecutionContext) => context.switchToHttp().getRequest<Request>().user,
);
