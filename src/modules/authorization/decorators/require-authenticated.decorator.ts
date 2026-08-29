import { applyDecorators, SetMetadata, UseGuards } from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';

import { AUTHENTICATED_ROUTE_KEY } from '../authorization.constants';
import { PermissionsGuard } from '../guards/permissions.guard';

export const RequireAuthenticated = (): MethodDecorator & ClassDecorator =>
  applyDecorators(
    SetMetadata(AUTHENTICATED_ROUTE_KEY, true),
    UseGuards(PermissionsGuard),
    ApiBearerAuth(),
  );
