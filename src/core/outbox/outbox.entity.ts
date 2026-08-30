import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import type { OutboxPayload, OutboxStatus, OutboxTopic } from './outbox.types';

@Entity({ name: 'outbox_messages' })
export class OutboxMessageEntity {
  @PrimaryGeneratedColumn('uuid')
  public id!: string;

  @Column({ type: 'varchar', length: 64 })
  public topic!: OutboxTopic;

  @Column({ type: 'integer', default: 1 })
  public version!: number;

  @Column({ type: 'jsonb' })
  public payload!: OutboxPayload;

  @Column({ name: 'correlation_id', type: 'varchar', length: 128 })
  public correlationId!: string;

  @Column({ type: 'varchar', length: 16, default: 'pending' })
  public status!: OutboxStatus;

  @Column({ type: 'integer', default: 0 })
  public attempts!: number;

  @Column({ name: 'available_at', type: 'timestamptz', default: () => 'now()' })
  public availableAt!: Date;

  @Column({ name: 'lease_until', type: 'timestamptz', nullable: true })
  public leaseUntil!: Date | null;

  @Column({ name: 'lease_token', type: 'uuid', nullable: true })
  public leaseToken!: string | null;

  @Column({ name: 'last_error_code', type: 'varchar', length: 64, nullable: true })
  public lastErrorCode!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  public createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  public updatedAt!: Date;
}
