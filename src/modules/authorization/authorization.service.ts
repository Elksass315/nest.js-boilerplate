import { Injectable } from '@nestjs/common';

import { buildOffsetPage, type OffsetPage } from '@/common/pagination';
import { AppException } from '@/core/errors/app.exception';

import type { RoleKey } from './authorization.constants';
import { AuthorizationRepository } from './authorization.repository';
import type { RoleDefinition } from './authorization.types';
import type { RoleResponseDto } from './dto/role-response.dto';
import type { RoleEntity } from './entities/role.entity';

@Injectable()
export class AuthorizationService {
  public constructor(private readonly repository: AuthorizationRepository) {}

  public async listRoles(page: number, limit: number): Promise<OffsetPage<RoleResponseDto>> {
    const [roles, total] = await this.repository.findPage(page, limit);
    const definitions = await this.toDefinitions(roles);
    return buildOffsetPage(definitions, total, page, limit);
  }

  public async getRequiredRole(key: RoleKey): Promise<RoleDefinition> {
    const role = await this.repository.findByKey(key);
    if (!role) throw new AppException('ROLE_NOT_FOUND', { key });
    const [definition] = await this.toDefinitions([role]);
    if (!definition) throw new AppException('ROLE_NOT_FOUND', { key });
    return definition;
  }

  public async resolveRoles(ids: readonly string[]): Promise<RoleDefinition[]> {
    return this.toDefinitions(await this.repository.findByIds(ids));
  }

  public async requireRoleIds(ids: readonly string[]): Promise<RoleDefinition[]> {
    const uniqueIds = [...new Set(ids)];
    const roles = await this.resolveRoles(uniqueIds);
    if (roles.length !== uniqueIds.length) throw new AppException('ROLE_NOT_FOUND');
    return roles;
  }

  private async toDefinitions(roles: RoleEntity[]): Promise<RoleDefinition[]> {
    const permissions = await this.repository.findPermissionsByRoleIds(roles.map(({ id }) => id));
    return roles.map((role) => ({
      id: role.id,
      key: role.key,
      name: role.name,
      description: role.description,
      permissions: permissions.get(role.id) ?? [],
    }));
  }
}
