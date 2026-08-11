import { Column, Entity, Unique } from 'typeorm';

import { AppBaseEntity } from '@/shared/entities/app-base.entity';

import type { Permission } from '../authorization.constants';

@Entity({ name: 'authorization_permissions' })
@Unique('UQ_authorization_permissions_key', ['key'])
export class PermissionEntity extends AppBaseEntity {
  @Column({ type: 'varchar', length: 100 })
  public key!: Permission;

  @Column({ type: 'varchar', length: 240 })
  public description!: string;
}
