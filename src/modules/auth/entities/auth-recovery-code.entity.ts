import { Column, Entity, ForeignKey, Index } from 'typeorm';

import { AppBaseEntity } from '@/shared/entities/app-base.entity';

@Entity({ name: 'auth_recovery_codes' })
@Index('IDX_auth_recovery_codes_user_available', ['userId', 'consumedAt'])
export class AuthRecoveryCodeEntity extends AppBaseEntity {
  @ForeignKey('UserEntity', { name: 'FK_auth_recovery_codes_user', onDelete: 'CASCADE' })
  @Column({ name: 'user_id', type: 'uuid' })
  public userId!: string;

  @Column({ name: 'code_hash', type: 'varchar', length: 255 })
  public codeHash!: string;

  @Column({ name: 'consumed_at', type: 'timestamptz', nullable: true })
  public consumedAt!: Date | null;
}
