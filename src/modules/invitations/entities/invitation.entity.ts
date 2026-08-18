import { Check, Column, Entity, Index } from 'typeorm';

import type { RoleKey } from '@/modules/authorization';
import { AppBaseEntity } from '@/shared/entities/app-base.entity';

import type { InvitationStatus } from '../invitations.constants';

@Entity({ name: 'team_invitations' })
@Index('IDX_team_invitations_status_created', ['status', 'createdAt'])
@Index('IDX_team_invitations_normalized_email', ['normalizedEmail'])
@Index('IDX_team_invitations_expires_at', ['status', 'expiresAt'])
@Check('CHK_team_invitations_status', `"status" IN ('pending', 'accepted', 'expired', 'revoked')`)
@Check('CHK_team_invitations_send_count', '"send_count" >= 1')
export class InvitationEntity extends AppBaseEntity {
  @Column({ type: 'varchar', length: 320 })
  public email!: string;

  @Column({ name: 'normalized_email', type: 'varchar', length: 320 })
  public normalizedEmail!: string;

  @Column({ name: 'role_id', type: 'uuid' })
  public roleId!: string;

  @Column({ name: 'role_key', type: 'varchar', length: 64 })
  public roleKey!: RoleKey;

  @Column({ type: 'varchar', length: 16, default: 'pending' })
  public status!: InvitationStatus;

  @Column({ name: 'token_hash', type: 'varchar', length: 64 })
  public tokenHash!: string;

  @Column({ name: 'invited_by_user_id', type: 'uuid' })
  public invitedByUserId!: string;

  @Column({ name: 'accepted_by_user_id', type: 'uuid', nullable: true })
  public acceptedByUserId!: string | null;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  public expiresAt!: Date;

  @Column({ name: 'accepted_at', type: 'timestamptz', nullable: true })
  public acceptedAt!: Date | null;

  @Column({ name: 'revoked_at', type: 'timestamptz', nullable: true })
  public revokedAt!: Date | null;

  @Column({ name: 'last_sent_at', type: 'timestamptz' })
  public lastSentAt!: Date;

  @Column({ name: 'send_count', type: 'integer', default: 1 })
  public sendCount!: number;
}
