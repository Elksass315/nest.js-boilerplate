import { applyDecorators, SetMetadata, UseGuards } from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';

import { REQUIRED_PERMISSIONS_KEY, type Permission } from '../authorization.constants';
import { PermissionsGuard } from '../guards/permissions.guard';

export const RequirePermissions = (
  ...permissions: readonly Permission[]
): MethodDecorator & ClassDecorator =>
  applyDecorators(
    SetMetadata(REQUIRED_PERMISSIONS_KEY, permissions),
    UseGuards(PermissionsGuard),
    ApiBearerAuth(),
  );
