import { SetMetadata } from '@nestjs/common';

import type { Permission } from '../authorization.constants';

export const REQUIRED_PERMISSIONS_KEY = 'authorization:permissions';

export const RequirePermissions = (
  ...permissions: readonly Permission[]
): MethodDecorator & ClassDecorator => SetMetadata(REQUIRED_PERMISSIONS_KEY, permissions);
