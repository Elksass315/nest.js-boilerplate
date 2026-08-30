import { Injectable } from '@nestjs/common';

import { buildOffsetPage, type OffsetPage } from '@/common/pagination';
import { AppException } from '@/core/errors/app.exception';

import type { Permission, RoleKey } from './authorization.constants';
import { AuthorizationRepository } from './authorization.repository';
import type { RoleDefinition } from './authorization.types';
import type { RoleResponseDto } from './dto/role-response.dto';
import type { RoleEntity } from './entities/role.entity';
import type { EntityManager } from 'typeorm';

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

  public async applyUserOverrides(
    userId: string,
    roles: RoleDefinition[],
  ): Promise<RoleDefinition[]> {
    return (await this.applyUserOverridesForUsers(new Map([[userId, roles]]))).get(userId) ?? [];
  }

  public async applyUserOverridesForUsers(
    rolesByUserId: ReadonlyMap<string, RoleDefinition[]>,
  ): Promise<Map<string, RoleDefinition[]>> {
    const result = new Map(
      [...rolesByUserId].map(([userId, roles]) => [
        userId,
        roles.map((role) => ({ ...role, permissions: [...role.permissions] })),
      ]),
    );
    const overrides = await this.repository.findUserOverridesByUserIds([...rolesByUserId.keys()]);
    if (overrides.length === 0) return result;
    const permissions = await this.repository.findPermissionKeysByIds([
      ...new Set(overrides.map(({ permissionId }) => permissionId)),
    ]);
    const keysById = new Map(permissions.map(({ id, key }) => [id, key]));
    const overridesByUserId = new Map<string, typeof overrides>();
    for (const override of overrides) {
      const existing = overridesByUserId.get(override.userId) ?? [];
      existing.push(override);
      overridesByUserId.set(override.userId, existing);
    }
    for (const [userId, roles] of result) {
      const effective = new Set<Permission>(
        roles.flatMap(({ permissions: rolePermissions }) => rolePermissions),
      );
      for (const override of overridesByUserId.get(userId) ?? []) {
        const key = keysById.get(override.permissionId);
        if (!key) continue;
        if (override.effect === 'grant') effective.add(key);
        else effective.delete(key);
      }
      const sorted = [...effective].sort();
      result.set(
        userId,
        roles.map((role, index) => ({ ...role, permissions: index === 0 ? sorted : [] })),
      );
    }
    return result;
  }

  public async getUserPermissionOverrides(
    userId: string,
  ): Promise<{ key: Permission; effect: 'grant' | 'revoke' }[]> {
    const overrides = await this.repository.findUserOverrides(userId);
    const permissions = await this.repository.findPermissionKeysByIds(
      overrides.map(({ permissionId }) => permissionId),
    );
    const keys = new Map(permissions.map(({ id, key }) => [id, key]));
    return overrides.flatMap(({ permissionId, effect }) => {
      const key = keys.get(permissionId);
      return key ? [{ key, effect }] : [];
    });
  }

  public async resolvePermissionKeys(
    keys: readonly Permission[],
  ): Promise<Map<Permission, string>> {
    const rows = await this.repository.findPermissionsByKeys(keys);
    return new Map(rows.map(({ key, id }) => [key, id]));
  }

  public replaceUserPermissionOverrides(
    manager: EntityManager,
    userId: string,
    rows: readonly { permissionId: string; effect: 'grant' | 'revoke' }[],
  ): Promise<void> {
    return this.repository.replaceUserOverrides(manager, userId, rows);
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
