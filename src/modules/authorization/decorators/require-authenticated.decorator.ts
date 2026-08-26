import { applyDecorators, SetMetadata } from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';

export const AUTHENTICATED_ROUTE_KEY = 'authorization:authenticated';

export const RequireAuthenticated = (): MethodDecorator & ClassDecorator =>
  applyDecorators(SetMetadata(AUTHENTICATED_ROUTE_KEY, true), ApiBearerAuth());
