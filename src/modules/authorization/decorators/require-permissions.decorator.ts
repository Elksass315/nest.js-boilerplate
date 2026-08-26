import { applyDecorators, SetMetadata } from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';

import type { Permission } from '../authorization.constants';

export const REQUIRED_PERMISSIONS_KEY = 'authorization:permissions';

export const RequirePermissions = (
  ...permissions: readonly Permission[]
): MethodDecorator & ClassDecorator =>
  applyDecorators(SetMetadata(REQUIRED_PERMISSIONS_KEY, permissions), ApiBearerAuth());
