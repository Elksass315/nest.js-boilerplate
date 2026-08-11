import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, type Repository } from 'typeorm';

import type { Permission, RoleKey } from './authorization.constants';
import { PermissionEntity } from './entities/permission.entity';
import { RolePermissionEntity } from './entities/role-permission.entity';
import { RoleEntity } from './entities/role.entity';

@Injectable()
export class AuthorizationRepository {
  public constructor(
    @InjectRepository(RoleEntity)
    private readonly roles: Repository<RoleEntity>,
    @InjectRepository(RolePermissionEntity)
    private readonly rolePermissions: Repository<RolePermissionEntity>,
  ) {}

  public async findPage(page: number, limit: number): Promise<[RoleEntity[], number]> {
    return this.roles.findAndCount({
      order: { key: 'ASC', id: 'ASC' },
      skip: (page - 1) * limit,
      take: limit,
    });
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
