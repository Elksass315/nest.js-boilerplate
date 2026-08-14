import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';

import { AppException } from '@/core/errors/app.exception';

import type { Permission } from '../authorization.constants';
import type { AuthenticatedPrincipal } from '../authorization.types';
import { AUTHENTICATED_ROUTE_KEY } from '../decorators/require-authenticated.decorator';
import { REQUIRED_PERMISSIONS_KEY } from '../decorators/require-permissions.decorator';

@Injectable()
export class PermissionsGuard implements CanActivate {
  public constructor(private readonly reflector: Reflector) {}

  public canActivate(context: ExecutionContext): boolean {
    const authenticated = this.reflector.getAllAndOverride<boolean | undefined>(
      AUTHENTICATED_ROUTE_KEY,
      [context.getHandler(), context.getClass()],
    );
    const required = this.reflector.getAllAndOverride<readonly Permission[] | undefined>(
      REQUIRED_PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!authenticated && !required) return true;

    const principal: AuthenticatedPrincipal | undefined = context
      .switchToHttp()
      .getRequest<Request>().user;
    if (!principal) throw new AppException('UNAUTHORIZED');
    if (required?.some((permission) => !principal.permissions.includes(permission))) {
      throw new AppException('FORBIDDEN');
    }
    return true;
  }
}
