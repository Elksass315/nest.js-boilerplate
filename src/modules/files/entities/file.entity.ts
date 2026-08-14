import { Check, Column, Entity, Index } from 'typeorm';

import type { FileStorageDriver } from '@/config/configuration.types';
import { AppBaseEntity } from '@/shared/entities/app-base.entity';

import type { FileStatus, FileVisibility } from '../files.types';

@Entity({ name: 'stored_files' })
@Index('UQ_stored_files_public_id', ['publicId'], { unique: true })
@Index('UQ_stored_files_provider_key', ['provider', 'storageKey'], { unique: true })
@Index('IDX_stored_files_uploader_status', ['uploadedBy', 'status'])
@Index('IDX_stored_files_expiration', ['status', 'expiresAt'])
@Check('CHK_stored_files_provider', `"provider" IN ('local', 's3')`)
@Check('CHK_stored_files_visibility', `"visibility" IN ('protected', 'public')`)
@Check(
  'CHK_stored_files_status',
  `"status" IN ('uploading', 'uploaded', 'ready', 'deleting', 'failed')`,
)
@Check('CHK_stored_files_size', '"size_bytes" >= 0')
export class FileEntity extends AppBaseEntity {
  @Column({ name: 'public_id', type: 'uuid', unique: true })
  public publicId!: string;

  @Column({ type: 'varchar', length: 16 })
  public provider!: FileStorageDriver;

  @Column({ name: 'storage_key', type: 'varchar', length: 512 })
  public storageKey!: string;

  @Column({ name: 'original_name', type: 'varchar', length: 255 })
  public originalName!: string;

  @Column({ name: 'mime_type', type: 'varchar', length: 180 })
  public mimeType!: string;

  @Column({ name: 'size_bytes', type: 'bigint' })
  public sizeBytes!: string;

  @Column({ name: 'checksum_sha256', type: 'varchar', length: 64, nullable: true })
  public checksumSha256!: string | null;

  @Column({ type: 'varchar', length: 16, default: 'protected' })
  public visibility!: FileVisibility;

  @Column({ type: 'varchar', length: 16, default: 'uploading' })
  public status!: FileStatus;

  @Column({ type: 'varchar', length: 100 })
  public purpose!: string;

  @Column({ name: 'uploaded_by', type: 'uuid' })
  public uploadedBy!: string;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  public expiresAt!: Date;

  @Column({ name: 'completed_at', type: 'timestamptz', nullable: true })
  public completedAt!: Date | null;

  @Column({ name: 'claimed_at', type: 'timestamptz', nullable: true })
  public claimedAt!: Date | null;

  @Column({ name: 'delete_requested_at', type: 'timestamptz', nullable: true })
  public deleteRequestedAt!: Date | null;

  @Column({ name: 'failure_code', type: 'varchar', length: 100, nullable: true })
  public failureCode!: string | null;

  @Column({ name: 'pending_delete_provider', type: 'varchar', length: 16, nullable: true })
  public pendingDeleteProvider!: FileStorageDriver | null;

  @Column({ name: 'pending_delete_storage_key', type: 'varchar', length: 512, nullable: true })
  public pendingDeleteStorageKey!: string | null;

  @Column({ name: 'request_id', type: 'varchar', length: 128 })
  public requestId!: string;

  @Column({ name: 'correlation_id', type: 'varchar', length: 128 })
  public correlationId!: string;
}
