import { Check, Column, Entity, Index, Unique } from 'typeorm';

import { AppBaseEntity } from '@/shared/entities/app-base.entity';

import type { UserStatus } from '../users.constants';

@Entity({ name: 'users' })
@Unique('UQ_users_normalized_email', ['normalizedEmail'])
@Index('IDX_users_status_created_at', ['status', 'createdAt'])
@Check('CHK_users_status', `"status" IN ('pending_verification', 'active', 'suspended')`)
@Check('CHK_users_auth_version', '"auth_version" >= 1')
@Check('CHK_users_failed_login_count', '"failed_login_count" >= 0')
export class UserEntity extends AppBaseEntity {
  @Column({ name: 'full_name', type: 'varchar', length: 160 })
  public fullName!: string;

  @Column({ type: 'varchar', length: 320 })
  public email!: string;

  @Column({ name: 'normalized_email', type: 'varchar', length: 320 })
  public normalizedEmail!: string;

  @Column({ name: 'password_hash', type: 'varchar', length: 255 })
  public passwordHash!: string;

  @Column({ type: 'varchar', length: 32, default: 'pending_verification' })
  public status!: UserStatus;

  @Column({ name: 'email_verified_at', type: 'timestamptz', nullable: true })
  public emailVerifiedAt!: Date | null;

  @Column({ name: 'email_two_step_enabled', type: 'boolean', default: false })
  public emailTwoStepEnabled!: boolean;

  @Column({ name: 'auth_version', type: 'integer', default: 1 })
  public authVersion!: number;

  @Column({ name: 'failed_login_count', type: 'integer', default: 0 })
  public failedLoginCount!: number;

  @Column({ name: 'locked_until', type: 'timestamptz', nullable: true })
  public lockedUntil!: Date | null;

  @Column({ name: 'avatar_file_id', type: 'uuid', nullable: true, unique: true })
  public avatarFileId!: string | null;
}
