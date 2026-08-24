import { Check, Column, Entity, Index } from 'typeorm';

import { AppBaseEntity } from '@/shared/entities/app-base.entity';

@Entity({ name: 'feature_flags' })
@Index('UQ_feature_flags_key', ['key'], { unique: true })
@Check('CHK_feature_flags_version', '"version" >= 1')
export class FeatureFlagsEntity extends AppBaseEntity {
  @Column({ type: 'varchar', length: 100 })
  public key!: string;

  @Column({ type: 'varchar', length: 500 })
  public description!: string;

  @Column({ type: 'boolean', default: false })
  public enabled!: boolean;

  @Column({ type: 'integer', default: 1 })
  public version!: number;

  @Column({ name: 'updated_by_user_id', type: 'uuid' })
  public updatedByUserId!: string;
}
