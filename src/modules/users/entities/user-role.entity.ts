import { Column, Entity, ForeignKey, Index, Unique } from 'typeorm';

import { AppBaseEntity } from '@/shared/entities/app-base.entity';

import { UserEntity } from './user.entity';

@Entity({ name: 'user_roles' })
@Unique('UQ_user_roles_pair', ['userId', 'roleId'])
@Index('IDX_user_roles_role_id', ['roleId'])
export class UserRoleEntity extends AppBaseEntity {
  @ForeignKey(() => UserEntity, { name: 'FK_user_roles_user', onDelete: 'CASCADE' })
  @Column({ name: 'user_id', type: 'uuid' })
  public userId!: string;

  @ForeignKey('RoleEntity', { name: 'FK_user_roles_role', onDelete: 'RESTRICT' })
  @Column({ name: 'role_id', type: 'uuid' })
  public roleId!: string;
}
