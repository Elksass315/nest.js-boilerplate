import { GUARDS_METADATA } from '@nestjs/common/constants';

import {
  AUTHENTICATED_ROUTE_KEY,
  PUBLIC_ROUTE_KEY,
  REQUIRED_PERMISSIONS_KEY,
} from '../authorization.constants';
import { PermissionsGuard } from '../guards/permissions.guard';
import { Public } from './public.decorator';
import { RequireAuthenticated } from './require-authenticated.decorator';
import { RequirePermissions } from './require-permissions.decorator';

describe('authorization policy decorators', () => {
  class TestController {
    @RequireAuthenticated()
    public authenticated(): string {
      return 'authenticated';
    }

    @RequirePermissions('users.read')
    public permitted(): string {
      return 'permitted';
    }

    @Public()
    public publicRoute(): string {
      return 'public';
    }
  }

  it('installs the permission guard with authenticated metadata', () => {
    expect(
      Reflect.getMetadata(AUTHENTICATED_ROUTE_KEY, TestController.prototype.authenticated),
    ).toBe(true);
    expect(Reflect.getMetadata(GUARDS_METADATA, TestController.prototype.authenticated)).toContain(
      PermissionsGuard,
    );
  });

  it('installs the permission guard with required permissions', () => {
    expect(
      Reflect.getMetadata(REQUIRED_PERMISSIONS_KEY, TestController.prototype.permitted),
    ).toEqual(['users.read']);
    expect(Reflect.getMetadata(GUARDS_METADATA, TestController.prototype.permitted)).toContain(
      PermissionsGuard,
    );
  });

  it('marks intentionally anonymous routes', () => {
    expect(Reflect.getMetadata(PUBLIC_ROUTE_KEY, TestController.prototype.publicRoute)).toBe(true);
    expect(
      Reflect.getMetadata(GUARDS_METADATA, TestController.prototype.publicRoute),
    ).toBeUndefined();
  });
});
