import { Column, Entity, Unique } from 'typeorm';

import { AppBaseEntity } from '@/shared/entities/app-base.entity';

import type { RoleKey } from '../authorization.constants';

@Entity({ name: 'authorization_roles' })
@Unique('UQ_authorization_roles_key', ['key'])
export class RoleEntity extends AppBaseEntity {
  @Column({ type: 'varchar', length: 64 })
  public key!: RoleKey;

  @Column({ type: 'varchar', length: 100 })
  public name!: string;

  @Column({ type: 'varchar', length: 240 })
  public description!: string;

  @Column({ name: 'is_system', type: 'boolean', default: true })
  public isSystem!: boolean;
}
