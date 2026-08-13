import { Check, Column, Entity, Index } from 'typeorm';

import { AppBaseEntity } from '@/shared/entities/app-base.entity';

import type { MailDeliveryStatus, MailTemplate } from '../mail.types';

@Entity({ name: 'mail_deliveries' })
@Index('IDX_mail_deliveries_status_created', ['status', 'createdAt'])
@Index('IDX_mail_deliveries_recipient_hash', ['recipientHash', 'createdAt'])
@Check('CHK_mail_deliveries_status', `"status" IN ('queued', 'processing', 'sent', 'failed')`)
@Check('CHK_mail_deliveries_attempts', '"attempts" >= 0')
export class MailDeliveryEntity extends AppBaseEntity {
  @Column({ name: 'recipient_hash', type: 'varchar', length: 64 })
  public recipientHash!: string;

  @Column({ name: 'masked_recipient', type: 'varchar', length: 320 })
  public maskedRecipient!: string;

  @Column({ type: 'varchar', length: 64 })
  public template!: MailTemplate;

  @Column({ type: 'varchar', length: 16, default: 'queued' })
  public status!: MailDeliveryStatus;

  @Column({ type: 'integer', default: 0 })
  public attempts!: number;

  @Column({ type: 'varchar', length: 64, nullable: true })
  public provider!: string | null;

  @Column({ name: 'error_code', type: 'varchar', length: 100, nullable: true })
  public errorCode!: string | null;

  @Column({ name: 'correlation_id', type: 'varchar', length: 128, nullable: true })
  public correlationId!: string | null;

  @Column({ name: 'sent_at', type: 'timestamptz', nullable: true })
  public sentAt!: Date | null;
}
