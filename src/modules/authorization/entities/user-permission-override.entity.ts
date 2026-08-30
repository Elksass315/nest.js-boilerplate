import { Column, Entity, ForeignKey, Index, Unique } from 'typeorm';

import { AppBaseEntity } from '@/shared/entities/app-base.entity';

import { PermissionEntity } from './permission.entity';

export type UserPermissionEffect = 'grant' | 'revoke';

@Entity({ name: 'user_permission_overrides' })
@Unique('UQ_user_permission_overrides_user_permission', ['userId', 'permissionId'])
@Index('IDX_user_permission_overrides_permission_id', ['permissionId'])
export class UserPermissionOverrideEntity extends AppBaseEntity {
  @ForeignKey('UserEntity', { name: 'FK_user_permission_overrides_user', onDelete: 'CASCADE' })
  @Column({ name: 'user_id', type: 'uuid' })
  public userId!: string;

  @ForeignKey(() => PermissionEntity, {
    name: 'FK_user_permission_overrides_permission',
    onDelete: 'RESTRICT',
  })
  @Column({ name: 'permission_id', type: 'uuid' })
  public permissionId!: string;

  @Column({ type: 'varchar', length: 16 })
  public effect!: UserPermissionEffect;
}
