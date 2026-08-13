import { Check, Column, Entity, ForeignKey, Index, Unique } from 'typeorm';

import { AppBaseEntity } from '@/shared/entities/app-base.entity';

import type { TwoStepPurpose } from '../auth.constants';

@Entity({ name: 'auth_two_step_challenges' })
@Unique('UQ_auth_two_step_challenges_token_hash', ['tokenHash'])
@Index('IDX_auth_two_step_challenges_user_purpose', ['userId', 'purpose', 'consumedAt'])
@Check(
  'CHK_auth_two_step_challenges_purpose',
  `"purpose" IN ('login', 'enable', 'disable', 'recovery_regenerate')`,
)
@Check('CHK_auth_two_step_challenges_attempts', '"attempts" >= 0')
export class AuthTwoStepChallengeEntity extends AppBaseEntity {
  @ForeignKey('UserEntity', { name: 'FK_auth_two_step_challenges_user', onDelete: 'CASCADE' })
  @Column({ name: 'user_id', type: 'uuid' })
  public userId!: string;

  @Column({ type: 'varchar', length: 32 })
  public purpose!: TwoStepPurpose;

  @Column({ name: 'token_hash', type: 'varchar', length: 64 })
  public tokenHash!: string;

  @Column({ name: 'code_hash', type: 'varchar', length: 255 })
  public codeHash!: string;

  @Column({ type: 'integer', default: 0 })
  public attempts!: number;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  public expiresAt!: Date;

  @Column({ name: 'consumed_at', type: 'timestamptz', nullable: true })
  public consumedAt!: Date | null;
}
