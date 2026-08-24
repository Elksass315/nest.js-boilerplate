import { Check, Column, Entity, Index } from 'typeorm';

import { AppBaseEntity } from '@/shared/entities/app-base.entity';

@Entity({ name: 'notification_preferences' })
@Index('UQ_notification_preferences_user', ['userId'], { unique: true })
@Check('CHK_notification_preferences_version', '"version" >= 1')
export class NotificationPreferencesEntity extends AppBaseEntity {
  @Column({ name: 'user_id', type: 'uuid' })
  public userId!: string;

  @Column({ name: 'product_updates_email', type: 'boolean', default: false })
  public productUpdatesEmail!: boolean;

  @Column({ name: 'marketing_email', type: 'boolean', default: false })
  public marketingEmail!: boolean;

  @Column({ type: 'integer', default: 1 })
  public version!: number;
}
