import { Column, Entity, ForeignKey, Index, Unique } from 'typeorm';

import { AppBaseEntity } from '@/shared/entities/app-base.entity';

import { PermissionEntity } from './permission.entity';
import { RoleEntity } from './role.entity';

@Entity({ name: 'authorization_role_permissions' })
@Unique('UQ_authorization_role_permissions_pair', ['roleId', 'permissionId'])
@Index('IDX_authorization_role_permissions_permission', ['permissionId'])
export class RolePermissionEntity extends AppBaseEntity {
  @ForeignKey(() => RoleEntity, {
    name: 'FK_authorization_role_permissions_role',
    onDelete: 'CASCADE',
  })
  @Column({ name: 'role_id', type: 'uuid' })
  public roleId!: string;

  @ForeignKey(() => PermissionEntity, {
    name: 'FK_authorization_role_permissions_permission',
    onDelete: 'CASCADE',
  })
  @Column({ name: 'permission_id', type: 'uuid' })
  public permissionId!: string;
}
