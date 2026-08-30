import { Check, Column, Entity, ForeignKey, Index } from 'typeorm';

import { AppBaseEntity } from '@/shared/entities/app-base.entity';

@Entity({ name: 'auth_email_verification_codes' })
@Index('IDX_auth_email_verification_codes_user_active', ['userId', 'consumedAt', 'createdAt'])
@Check('CHK_auth_email_verification_codes_attempts', '"attempts" >= 0')
export class AuthEmailVerificationCodeEntity extends AppBaseEntity {
  @ForeignKey('UserEntity', { name: 'FK_auth_email_verification_codes_user', onDelete: 'CASCADE' })
  @Column({ name: 'user_id', type: 'uuid' })
  public userId!: string;

  @Column({ name: 'code_hash', type: 'varchar', length: 255 })
  public codeHash!: string;

  @Column({ type: 'integer', default: 0 })
  public attempts!: number;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  public expiresAt!: Date;

  @Column({ name: 'consumed_at', type: 'timestamptz', nullable: true })
  public consumedAt!: Date | null;
}
