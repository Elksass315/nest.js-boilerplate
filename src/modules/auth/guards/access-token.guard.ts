import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import type { Request } from 'express';

import { AppException } from '@/core/errors/app.exception';
import { UsersService } from '@/modules/users';

import { AuthCryptoService } from '../auth-crypto.service';
import { AuthRepository } from '../auth.repository';

@Injectable()
export class AccessTokenGuard implements CanActivate {
  public constructor(
    private readonly crypto: AuthCryptoService,
    private readonly repository: AuthRepository,
    private readonly users: UsersService,
  ) {}

  public async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const authorization = request.headers.authorization;
    if (!authorization) return true;
    const match = /^Bearer ([A-Za-z0-9._~-]+)$/.exec(authorization);
    if (!match?.[1]) throw new AppException('UNAUTHORIZED');
    const claims = await this.crypto.verifyAccessToken(match[1]);
    if (!claims) throw new AppException('UNAUTHORIZED');
    const [session, user] = await Promise.all([
      this.repository.findActiveSession(claims.sessionId),
      this.users.findByIdForAuthentication(claims.userId),
    ]);
    if (
      session?.userId !== claims.userId ||
      session.authVersion !== claims.authVersion ||
      user?.status !== 'active' ||
      user.authVersion !== claims.authVersion
    ) {
      throw new AppException('UNAUTHORIZED');
    }
    request.user = {
      userId: user.id,
      sessionId: session.id,
      authVersion: user.authVersion,
      roleKeys: user.roles.map(({ key }) => key),
      permissions: [...new Set(user.roles.flatMap(({ permissions }) => permissions))],
    };
    return true;
  }
}
