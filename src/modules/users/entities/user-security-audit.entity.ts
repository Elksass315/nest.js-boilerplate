import { Column, Entity, ForeignKey, Index } from 'typeorm';

import { AppBaseEntity } from '@/shared/entities/app-base.entity';

import type { SecurityAuditEvent } from '../users.constants';
import { UserEntity } from './user.entity';

@Entity({ name: 'user_security_audits' })
@Index('IDX_user_security_audits_user_created', ['userId', 'createdAt'])
@Index('IDX_user_security_audits_correlation', ['correlationId'])
export class UserSecurityAuditEntity extends AppBaseEntity {
  @ForeignKey(() => UserEntity, {
    name: 'FK_user_security_audits_user',
    onDelete: 'SET NULL',
  })
  @Column({ name: 'user_id', type: 'uuid', nullable: true })
  public userId!: string | null;

  @ForeignKey(() => UserEntity, {
    name: 'FK_user_security_audits_actor',
    onDelete: 'SET NULL',
  })
  @Column({ name: 'actor_user_id', type: 'uuid', nullable: true })
  public actorUserId!: string | null;

  @Column({ name: 'event_type', type: 'varchar', length: 100 })
  public eventType!: SecurityAuditEvent;

  @Column({ name: 'request_id', type: 'varchar', length: 160, nullable: true })
  public requestId!: string | null;

  @Column({ name: 'correlation_id', type: 'varchar', length: 160, nullable: true })
  public correlationId!: string | null;

  @Column({ type: 'jsonb', default: {} })
  public metadata!: Record<string, unknown>;
}
