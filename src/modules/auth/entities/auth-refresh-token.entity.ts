import { Check, Column, Entity, ForeignKey, Index, Unique } from 'typeorm';

import { AppBaseEntity } from '@/shared/entities/app-base.entity';

import type { RefreshTokenStatus } from '../auth.constants';
import { AuthSessionEntity } from './auth-session.entity';

@Entity({ name: 'auth_refresh_tokens' })
@Unique('UQ_auth_refresh_tokens_hash', ['tokenHash'])
@Index('IDX_auth_refresh_tokens_session_status', ['sessionId', 'status'])
@Check('CHK_auth_refresh_tokens_status', `"status" IN ('active', 'rotated', 'revoked')`)
export class AuthRefreshTokenEntity extends AppBaseEntity {
  @ForeignKey(() => AuthSessionEntity, {
    name: 'FK_auth_refresh_tokens_session',
    onDelete: 'CASCADE',
  })
  @Column({ name: 'session_id', type: 'uuid' })
  public sessionId!: string;

  @Column({ name: 'token_hash', type: 'varchar', length: 64 })
  public tokenHash!: string;

  @Column({ type: 'varchar', length: 16, default: 'active' })
  public status!: RefreshTokenStatus;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  public expiresAt!: Date;
}
