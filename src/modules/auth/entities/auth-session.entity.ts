import { Check, Column, Entity, ForeignKey, Index } from 'typeorm';

import { AppBaseEntity } from '@/shared/entities/app-base.entity';

@Entity({ name: 'auth_sessions' })
@Index('IDX_auth_sessions_user_active', ['userId', 'revokedAt', 'lastUsedAt'])
@Check('CHK_auth_sessions_auth_version', '"auth_version" >= 1')
export class AuthSessionEntity extends AppBaseEntity {
  @ForeignKey('UserEntity', { name: 'FK_auth_sessions_user', onDelete: 'CASCADE' })
  @Column({ name: 'user_id', type: 'uuid' })
  public userId!: string;

  @Column({ name: 'auth_version', type: 'integer' })
  public authVersion!: number;

  @Column({ name: 'last_used_at', type: 'timestamptz' })
  public lastUsedAt!: Date;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  public expiresAt!: Date;

  @Column({ name: 'revoked_at', type: 'timestamptz', nullable: true })
  public revokedAt!: Date | null;

  @Column({ name: 'revoke_reason', type: 'varchar', length: 40, nullable: true })
  public revokeReason!: string | null;
}
