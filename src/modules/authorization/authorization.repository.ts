import { Injectable, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, In, type Repository } from 'typeorm';

import type { Permission, RoleKey } from './authorization.constants';
import { PermissionEntity } from './entities/permission.entity';
import { RolePermissionEntity } from './entities/role-permission.entity';
import { RoleEntity } from './entities/role.entity';
import { UserPermissionOverrideEntity } from './entities/user-permission-override.entity';

@Injectable()
export class AuthorizationRepository {
  public constructor(
    @InjectRepository(RoleEntity)
    private readonly roles: Repository<RoleEntity>,
    @InjectRepository(PermissionEntity)
    private readonly permissions: Repository<PermissionEntity>,
    @InjectRepository(RolePermissionEntity)
    private readonly rolePermissions: Repository<RolePermissionEntity>,
    @InjectRepository(UserPermissionOverrideEntity)
    @Optional()
    private readonly overrides: Repository<UserPermissionOverrideEntity> | undefined,
  ) {}

  public async findPage(page: number, limit: number): Promise<[RoleEntity[], number]> {
    return this.roles.findAndCount({
      order: { key: 'ASC', id: 'ASC' },
      skip: (page - 1) * limit,
      take: limit,
    });
  }

  public findUserOverrides(userId: string): Promise<UserPermissionOverrideEntity[]> {
    return this.overrides
      ? this.overrides.find({ where: { userId }, order: { createdAt: 'ASC', id: 'ASC' } })
      : Promise.resolve([]);
  }

  public findPermissionKeysByIds(ids: readonly string[]): Promise<PermissionEntity[]> {
    return ids.length === 0 ? Promise.resolve([]) : this.permissions.findBy({ id: In([...ids]) });
  }

  public findPermissionsByKeys(keys: readonly Permission[]): Promise<PermissionEntity[]> {
    return keys.length === 0
      ? Promise.resolve([])
      : this.permissions.findBy({ key: In([...keys]) });
  }

  public async replaceUserOverrides(
    manager: EntityManager,
    userId: string,
    rows: readonly { permissionId: string; effect: 'grant' | 'revoke' }[],
  ): Promise<void> {
    const repository = manager.getRepository(UserPermissionOverrideEntity);
    await repository.delete({ userId });
    if (rows.length > 0)
      await repository.insert(rows.map((row) => repository.create({ userId, ...row })));
  }

  public findByKey(key: RoleKey): Promise<RoleEntity | null> {
    return this.roles.findOneBy({ key });
  }

  public findByIds(ids: readonly string[]): Promise<RoleEntity[]> {
    return ids.length === 0 ? Promise.resolve([]) : this.roles.findBy({ id: In([...ids]) });
  }

  public async findPermissionsByRoleIds(
    roleIds: readonly string[],
  ): Promise<Map<string, Permission[]>> {
    if (roleIds.length === 0) return new Map();
    const rows = await this.rolePermissions
      .createQueryBuilder('rolePermission')
      .innerJoin(PermissionEntity, 'permission', 'permission.id = rolePermission.permission_id')
      .select('rolePermission.role_id', 'roleId')
      .addSelect('permission.key', 'permissionKey')
      .where('rolePermission.role_id IN (:...roleIds)', { roleIds })
      .orderBy('permission.key', 'ASC')
      .getRawMany<{ roleId: string; permissionKey: Permission }>();
    const result = new Map<string, Permission[]>();
    for (const row of rows) {
      result.set(row.roleId, [...(result.get(row.roleId) ?? []), row.permissionKey]);
    }
    return result;
  }
}
