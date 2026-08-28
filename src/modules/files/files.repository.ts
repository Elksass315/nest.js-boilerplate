import { randomUUID } from 'node:crypto';

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, IsNull, LessThan, Repository } from 'typeorm';
import type { EntityManager, QueryRunner } from 'typeorm';

import type { FileStorageDriver } from '@/config/configuration.types';

import { FileEntity } from './entities/file.entity';
import type {
  PreparedFileContent,
  PublicFileDescriptor,
  StoredFile,
  TusRequestContext,
} from './files.types';

@Injectable()
export class FilesRepository {
  public constructor(
    @InjectRepository(FileEntity) private readonly files: Repository<FileEntity>,
    private readonly dataSource: DataSource,
  ) {}

  public async createUpload(
    id: string,
    provider: FileStorageDriver,
    originalName: string,
    mimeType: string,
    sizeBytes: number,
    expiresAt: Date,
    context: TusRequestContext & { uploaderId: string },
  ): Promise<StoredFile> {
    const entity = this.files.create({
      id,
      publicId: randomUUID(),
      provider,
      storageKey: id,
      originalName,
      mimeType,
      sizeBytes: String(sizeBytes),
      checksumSha256: null,
      visibility: 'protected',
      status: 'uploading',
      purpose: context.policy.purpose,
      uploadedBy: context.uploaderId,
      expiresAt,
      completedAt: null,
      claimedAt: null,
      deleteRequestedAt: null,
      failureCode: null,
      requestId: context.requestId,
      correlationId: context.correlationId,
    });
    return this.toStoredFile(await this.files.save(entity));
  }

  public async findById(id: string): Promise<StoredFile | null> {
    const entity = await this.files.findOneBy({ id });
    return entity ? this.toStoredFile(entity) : null;
  }

  public async findByIdForUpdate(manager: EntityManager, id: string): Promise<StoredFile | null> {
    const entity = await manager.getRepository(FileEntity).findOne({
      where: { id },
      lock: { mode: 'pessimistic_write' },
    });
    return entity ? this.toStoredFile(entity) : null;
  }

  public async findReadyPublicByIds(ids: readonly string[]): Promise<PublicFileDescriptor[]> {
    if (ids.length === 0) return [];
    const entities = await this.files.find({
      where: { id: In([...ids]), status: 'ready', visibility: 'public' },
    });
    return entities.map((entity) => this.toPublicDescriptor(entity));
  }

  public async claimPrepared(
    manager: EntityManager,
    file: StoredFile,
    prepared: PreparedFileContent,
  ): Promise<PublicFileDescriptor> {
    const repository = manager.getRepository(FileEntity);
    const entity = await repository.findOneByOrFail({ id: file.id });
    entity.pendingDeleteProvider = file.provider;
    entity.pendingDeleteStorageKey = file.storageKey;
    entity.provider = prepared.provider;
    entity.storageKey = prepared.storageKey;
    entity.mimeType = prepared.mimeType;
    entity.sizeBytes = String(prepared.sizeBytes);
    entity.checksumSha256 = prepared.checksumSha256;
    entity.visibility = 'public';
    entity.status = 'ready';
    entity.claimedAt = new Date();
    entity.failureCode = null;
    return this.toPublicDescriptor(await repository.save(entity));
  }

  public async markDeletingInTransaction(manager: EntityManager, id: string): Promise<void> {
    await manager
      .getRepository(FileEntity)
      .update({ id, status: 'ready' }, { status: 'deleting', deleteRequestedAt: new Date() });
  }

  public async findPublic(publicId: string): Promise<StoredFile | null> {
    const entity = await this.files.findOneBy({ publicId, visibility: 'public', status: 'ready' });
    return entity ? this.toStoredFile(entity) : null;
  }

  public async markUploaded(id: string, sizeBytes: number, checksumSha256: string): Promise<void> {
    await this.files.update(
      { id, status: 'uploading' },
      {
        status: 'uploaded',
        sizeBytes: String(sizeBytes),
        checksumSha256,
        completedAt: new Date(),
      },
    );
  }

  public async withCleanupLock<T>(work: () => Promise<T>): Promise<T> {
    const runner: QueryRunner = this.dataSource.createQueryRunner();
    await runner.connect();
    try {
      await runner.query("SELECT pg_advisory_lock(hashtext('files:cleanup'))");
      return await work();
    } finally {
      await runner.query("SELECT pg_advisory_unlock(hashtext('files:cleanup'))");
      await runner.release();
    }
  }

  public async markDeleting(id: string, manager?: EntityManager): Promise<void> {
    await (manager?.getRepository(FileEntity) ?? this.files).update(
      { id },
      { status: 'deleting', deleteRequestedAt: new Date() },
    );
  }

  public async markFailed(id: string, failureCode: string): Promise<void> {
    await this.files.update({ id }, { status: 'failed', failureCode });
  }

  public async recordDeleteFailure(id: string, failureCode: string): Promise<void> {
    await this.files.update({ id, status: 'deleting' }, { failureCode });
  }

  public async removeMetadata(id: string): Promise<void> {
    await this.files.delete({ id });
  }

  public async cleanupTemporaryMetadata(before: Date, limit: number): Promise<number> {
    const result: unknown = await this.files.query(
      `DELETE FROM stored_files WHERE id IN (
         SELECT id FROM stored_files
          WHERE status = 'failed' AND claimed_at IS NULL AND expires_at < $1
         ORDER BY expires_at, id LIMIT $2
       )`,
      [before, limit],
    );
    return rowCount(result);
  }

  public async findCleanupCandidates(
    now: Date,
    limit: number,
    manager?: EntityManager,
  ): Promise<StoredFile[]> {
    const entities = await (manager?.getRepository(FileEntity) ?? this.files).find({
      where: [
        {
          status: In(['uploading', 'uploaded', 'failed']),
          claimedAt: IsNull(),
          expiresAt: LessThan(now),
        },
        { status: 'deleting' },
      ],
      order: { expiresAt: 'ASC', id: 'ASC' },
      take: limit,
    });
    return entities.map((entity) => this.toStoredFile(entity));
  }

  public countByProvider(provider: FileStorageDriver): Promise<number> {
    return this.files.countBy({ provider });
  }

  public async findMigrationBatch(
    provider: FileStorageDriver,
    afterId: string | null,
    limit: number,
  ): Promise<StoredFile[]> {
    const query = this.files
      .createQueryBuilder('file')
      .where('file.provider = :provider', { provider })
      .andWhere('file.status = :status', { status: 'ready' })
      .orderBy('file.id', 'ASC')
      .take(limit);
    if (afterId) query.andWhere('file.id > :afterId', { afterId });
    return (await query.getMany()).map((entity) => this.toStoredFile(entity));
  }

  public async switchProvider(
    id: string,
    source: FileStorageDriver,
    target: FileStorageDriver,
    targetKey: string,
    manager?: EntityManager,
  ): Promise<boolean> {
    const result = await (manager?.getRepository(FileEntity) ?? this.files).update(
      { id, provider: source, status: 'ready' },
      {
        provider: target,
        storageKey: targetKey,
        pendingDeleteProvider: source,
        pendingDeleteStorageKey: () => '"storage_key"',
      },
    );
    return (result.affected ?? 0) === 1;
  }

  public async clearPendingMigrationSource(id: string): Promise<void> {
    await this.files.update({ id }, { pendingDeleteProvider: null, pendingDeleteStorageKey: null });
  }

  public async findPendingMigrationSourceCleanup(
    limit: number,
    manager?: EntityManager,
  ): Promise<StoredFile[]> {
    const repository = manager?.getRepository(FileEntity) ?? this.files;
    return (
      await repository
        .createQueryBuilder('file')
        .where('file.pending_delete_provider IS NOT NULL')
        .andWhere('file.pending_delete_storage_key IS NOT NULL')
        .orderBy('file.updated_at', 'ASC')
        .addOrderBy('file.id', 'ASC')
        .take(limit)
        .getMany()
    ).map((entity) => this.toStoredFile(entity));
  }

  public async withMigrationLock<T>(work: () => Promise<T>): Promise<T> {
    const runner: QueryRunner = this.dataSource.createQueryRunner();
    await runner.connect();
    try {
      await runner.query("SELECT pg_advisory_lock(hashtext('files:migration'))");
      return await work();
    } finally {
      await runner.query("SELECT pg_advisory_unlock(hashtext('files:migration'))");
      await runner.release();
    }
  }

  private toStoredFile(entity: FileEntity): StoredFile {
    return {
      id: entity.id,
      publicId: entity.publicId,
      provider: entity.provider,
      storageKey: entity.storageKey,
      originalName: entity.originalName,
      mimeType: entity.mimeType,
      sizeBytes: entity.sizeBytes,
      checksumSha256: entity.checksumSha256,
      visibility: entity.visibility,
      status: entity.status,
      purpose: entity.purpose,
      uploadedBy: entity.uploadedBy,
      expiresAt: entity.expiresAt,
      completedAt: entity.completedAt,
      claimedAt: entity.claimedAt,
      deleteRequestedAt: entity.deleteRequestedAt,
      failureCode: entity.failureCode,
      pendingDeleteProvider: entity.pendingDeleteProvider,
      pendingDeleteStorageKey: entity.pendingDeleteStorageKey,
      requestId: entity.requestId,
      correlationId: entity.correlationId,
    };
  }

  private toPublicDescriptor(entity: FileEntity): PublicFileDescriptor {
    return {
      fileId: entity.id,
      publicId: entity.publicId,
      url: `/api/v1/files/public/${entity.publicId}`,
      mimeType: entity.mimeType,
      sizeBytes: Number(entity.sizeBytes),
    };
  }
}

function rowCount(value: unknown): number {
  return typeof value === 'object' &&
    value !== null &&
    'rowCount' in value &&
    typeof value.rowCount === 'number'
    ? value.rowCount
    : 0;
}
