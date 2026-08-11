import { SetMetadata } from '@nestjs/common';

export const AUTHENTICATED_ROUTE_KEY = 'authorization:authenticated';

export const RequireAuthenticated = (): MethodDecorator & ClassDecorator =>
  SetMetadata(AUTHENTICATED_ROUTE_KEY, true);
