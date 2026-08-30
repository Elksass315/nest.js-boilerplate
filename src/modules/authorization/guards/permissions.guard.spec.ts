import type { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { AppException } from '@/core/errors/app.exception';

import { AUTHENTICATED_ROUTE_KEY, REQUIRED_PERMISSIONS_KEY } from '../authorization.constants';
import type { AuthenticatedPrincipal } from '../authorization.types';
import { PermissionsGuard } from './permissions.guard';

describe(PermissionsGuard.name, () => {
  const principal: AuthenticatedPrincipal = {
    userId: '7b3f8ed4-73ef-4afe-8703-b10dd32f3820',
    authVersion: 1,
    roleKeys: ['admin'],
    permissions: ['users.read'],
  };

  function context(user?: AuthenticatedPrincipal): ExecutionContext {
    return {
      getHandler: () => context,
      getClass: () => PermissionsGuard,
      switchToHttp: () => ({ getRequest: () => ({ user }) }),
    } as unknown as ExecutionContext;
  }

  it('allows a principal with every required permission', () => {
    const reflector = new Reflector();
    Reflect.defineMetadata(REQUIRED_PERMISSIONS_KEY, ['users.read'], context);

    expect(new PermissionsGuard(reflector).canActivate(context(principal))).toBe(true);
  });

  it('leaves actual-role policy to the mutation service after a delegated permission passes', () => {
    const reflector = new Reflector();
    Reflect.defineMetadata(REQUIRED_PERMISSIONS_KEY, ['users.permissions.manage'], context);
    const delegatedPrincipal: AuthenticatedPrincipal = {
      ...principal,
      roleKeys: ['admin'],
      permissions: ['users.permissions.manage'],
    };

    expect(new PermissionsGuard(reflector).canActivate(context(delegatedPrincipal))).toBe(true);
    expect(delegatedPrincipal.roleKeys).not.toContain('super_admin');
  });

  it('rejects a protected route without a principal', () => {
    const reflector = new Reflector();
    Reflect.defineMetadata(AUTHENTICATED_ROUTE_KEY, true, context);

    expect(() => new PermissionsGuard(reflector).canActivate(context())).toThrow(AppException);
  });

  it('rejects a principal missing a required permission', () => {
    const reflector = new Reflector();
    Reflect.defineMetadata(REQUIRED_PERMISSIONS_KEY, ['users.roles.manage'], context);

    expect(() => new PermissionsGuard(reflector).canActivate(context(principal))).toThrow(
      AppException,
    );
  });
});
