import { Check, Column, Entity, ForeignKey, Index, Unique } from 'typeorm';

import { AppBaseEntity } from '@/shared/entities/app-base.entity';

import type { AuthTokenPurpose } from '../auth.constants';

@Entity({ name: 'auth_action_tokens' })
@Unique('UQ_auth_action_tokens_hash', ['tokenHash'])
@Index('IDX_auth_action_tokens_user_purpose', ['userId', 'purpose', 'consumedAt'])
@Check('CHK_auth_action_tokens_purpose', `"purpose" = 'password_reset'`)
export class AuthActionTokenEntity extends AppBaseEntity {
  @ForeignKey('UserEntity', { name: 'FK_auth_action_tokens_user', onDelete: 'CASCADE' })
  @Column({ name: 'user_id', type: 'uuid' })
  public userId!: string;

  @Column({ type: 'varchar', length: 32 })
  public purpose!: AuthTokenPurpose;

  @Column({ name: 'token_hash', type: 'varchar', length: 64 })
  public tokenHash!: string;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  public expiresAt!: Date;

  @Column({ name: 'consumed_at', type: 'timestamptz', nullable: true })
  public consumedAt!: Date | null;
}
