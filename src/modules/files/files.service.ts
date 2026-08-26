import { createHash, randomUUID } from 'node:crypto';
import path from 'node:path';
import type { Readable } from 'node:stream';
import type { Request, Response } from 'express';

import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Queue } from 'bullmq';
import { PinoLogger } from 'nestjs-pino';

import type { AppConfiguration } from '@/config/configuration.types';
import { AppException } from '@/core/errors/app.exception';

import { FilesRepository } from './files.repository';
import {
  FILE_DELETE_JOB,
  FILE_MIGRATION_SOURCE_DELETE_JOB,
  FILE_QUEUE,
  type FileClaimTransaction,
  type FileJob,
  type PreparedFileContent,
  type PublicFileAccess,
  type PublicFileDescriptor,
  type StoredFile,
  type TusRequestContext,
  type UploadedFileContent,
} from './files.types';
import { StorageProviderFactory } from './providers/storage-provider.factory';
import { RedisTusLocker } from './redis-tus-locker';
import { loadTusRuntime } from './tus-loader.cjs';

@Injectable()
export class FilesService {
  private readonly writeDriver: AppConfiguration['files']['writeDriver'];
  private readonly appBaseUrl: string;
  private readonly uploadExpirationMs: number;
  private readonly signedUrlTtlSeconds: number;
  private readonly maxRetries: number;
  private readonly retryDelayMs: number;

  public constructor(
    config: ConfigService<AppConfiguration, true>,
    private readonly repository: FilesRepository,
    private readonly providers: StorageProviderFactory,
    private readonly locker: RedisTusLocker,
    @InjectQueue(FILE_QUEUE) private readonly queue: Queue<FileJob>,
    private readonly logger: PinoLogger,
  ) {
    this.appBaseUrl = config.getOrThrow('app.baseUrl', { infer: true });
    const files = config.getOrThrow('files', { infer: true });
    this.writeDriver = files.writeDriver;
    this.uploadExpirationMs = files.uploadExpirationMs;
    this.signedUrlTtlSeconds = files.signedUrlTtlSeconds;
    this.maxRetries = files.maxRetries;
    this.retryDelayMs = files.retryDelayMs;
    this.logger.setContext(FilesService.name);
  }

  public async handleTus(
    request: Request,
    response: Response,
    context: TusRequestContext,
  ): Promise<void> {
    if (request.method !== 'OPTIONS' && context.uploaderId === null) {
      throw new AppException('UNAUTHORIZED');
    }
    const uploadId = uploadIdFromPath(request.path, context.routePath);
    const existing = uploadId ? await this.repository.findById(uploadId) : null;
    const provider = this.providers.resolve(existing?.provider ?? this.writeDriver);
    let runtime: Awaited<ReturnType<typeof loadTusRuntime>>;
    let datastore: Awaited<ReturnType<typeof provider.tusStore>>;
    try {
      [runtime, datastore] = await Promise.all([loadTusRuntime(), provider.tusStore()]);
    } catch (error) {
      this.logger.error(
        {
          provider: provider.driver,
          correlationId: context.correlationId,
          errorType: errorName(error),
        },
        'Resumable upload storage initialization failed',
      );
      throw new AppException('FILE_STORAGE_UNAVAILABLE');
    }
    const { Server } = runtime;
    const server = new Server({
      path: context.routePath,
      datastore,
      locker: this.locker,
      maxSize: context.policy.maxBytes,
      relativeLocation: true,
      respectForwardedHeaders: true,
      allowedCredentials: true,
      namingFunction: (): string => randomUUID(),
      onIncomingRequest: async (incoming, incomingUploadId): Promise<void> => {
        if (incoming.method === 'OPTIONS' || incoming.method === 'POST') return;
        const file = await this.repository.findById(incomingUploadId);
        if (file?.purpose !== context.policy.purpose) {
          throw new TusHookError(404, 'FILE_NOT_FOUND');
        }
        if (file.uploadedBy !== context.uploaderId) {
          throw new TusHookError(403, 'FILE_OWNERSHIP_MISMATCH');
        }
        if (file.expiresAt.getTime() <= Date.now() && file.status !== 'ready') {
          throw new TusHookError(410, 'FILE_UPLOAD_EXPIRED');
        }
      },
      onUploadCreate: async (_incoming, upload): Promise<{ metadata: Record<string, string> }> => {
        if (context.uploaderId === null) {
          throw new TusHookError(401, 'UNAUTHORIZED');
        }
        const uploaderId = context.uploaderId;
        if (upload.size === undefined || upload.size > context.policy.maxBytes) {
          throw new TusHookError(413, 'FILE_TOO_LARGE');
        }
        const originalName = normalizeFilename(upload.metadata?.['filename']);
        const mimeType = upload.metadata?.['filetype'] ?? '';
        if (!context.policy.allowedDeclaredMimeTypes.includes(mimeType)) {
          throw new TusHookError(415, 'FILE_TYPE_NOT_ALLOWED');
        }
        await this.repository.createUpload(
          upload.id,
          provider.driver,
          originalName,
          mimeType,
          upload.size,
          new Date(Date.now() + this.uploadExpirationMs),
          { ...context, uploaderId },
        );
        return { metadata: { filetype: mimeType } };
      },
      onUploadFinish: async (_incoming, upload): Promise<{ headers: Record<string, string> }> => {
        try {
          const checksum = await sha256Stream(await provider.read(upload.id));
          await this.repository.markUploaded(upload.id, upload.size ?? upload.offset, checksum);
        } catch (error) {
          await this.repository.markFailed(upload.id, 'FILE_COMPLETION_FAILED');
          throw error;
        }
        this.logger.info(
          {
            fileId: upload.id,
            provider: provider.driver,
            requestId: context.requestId,
            correlationId: context.correlationId,
          },
          'Resumable upload completed',
        );
        return { headers: { 'Upload-File-Id': upload.id } };
      },
      onResponseError: (_incoming, error): { status_code: number; body: string } => {
        const statusCode = 'status_code' in error ? error.status_code : 500;
        const code = error instanceof TusHookError ? error.code : codeForTusStatus(statusCode);
        const responseStatus = code === 'FILE_STORAGE_UNAVAILABLE' ? 503 : statusCode;
        return {
          status_code: responseStatus,
          body: JSON.stringify({
            statusCode: responseStatus,
            code,
            message: messageForTusCode(code),
            timestamp: new Date().toISOString(),
            path: request.originalUrl,
            requestId: context.requestId,
            correlationId: context.correlationId,
          }),
        };
      },
    });
    await server.handle(request, response);
    if (request.method === 'DELETE' && existing) {
      await this.repository.removeMetadata(existing.id);
      this.logger.info(
        {
          fileId: existing.id,
          provider: existing.provider,
          requestId: context.requestId,
          correlationId: context.correlationId,
        },
        'Resumable upload terminated',
      );
    }
  }

  public findById(id: string): Promise<StoredFile | null> {
    return this.repository.findById(id);
  }

  public async readUploadedForOwner(
    fileId: string,
    uploaderId: string,
    purpose: string,
    maxBytes: number,
  ): Promise<UploadedFileContent> {
    const file = await this.repository.findById(fileId);
    this.assertClaimable(file, uploaderId, purpose);
    const sizeBytes = Number(file.sizeBytes);
    if (!Number.isSafeInteger(sizeBytes) || sizeBytes > maxBytes) {
      throw new AppException('FILE_TOO_LARGE');
    }
    try {
      const stream = await this.providers.resolve(file.provider).read(file.storageKey);
      return {
        fileId: file.id,
        originalName: file.originalName,
        declaredMimeType: file.mimeType,
        sizeBytes,
        bytes: await readBounded(stream, maxBytes),
      };
    } catch (error) {
      if (error instanceof FileTooLargeStreamError) throw new AppException('FILE_TOO_LARGE');
      this.logger.error(
        { fileId: file.id, provider: file.provider, errorType: errorName(error) },
        'Uploaded file read failed',
      );
      throw new AppException('FILE_STORAGE_UNAVAILABLE');
    }
  }

  public async prepareReplacement(
    fileId: string,
    uploaderId: string,
    purpose: string,
    bytes: Buffer,
    mimeType: string,
  ): Promise<PreparedFileContent> {
    const file = await this.repository.findById(fileId);
    this.assertClaimable(file, uploaderId, purpose);
    const prepared: PreparedFileContent = {
      fileId,
      provider: file.provider,
      // A deterministic, per-upload key makes a crash between object creation and
      // the database claim recoverable by the normal expired-upload cleanup path.
      storageKey: `ready/${fileId}`,
      mimeType,
      sizeBytes: bytes.byteLength,
      checksumSha256: createHash('sha256').update(bytes).digest('hex'),
    };
    try {
      const provider = this.providers.resolve(prepared.provider);
      if (await provider.exists(prepared.storageKey)) {
        const existingChecksum = await sha256Stream(await provider.read(prepared.storageKey));
        if (existingChecksum !== prepared.checksumSha256) {
          throw new Error('Prepared object checksum mismatch');
        }
        return prepared;
      }
      await provider.write({
        key: prepared.storageKey,
        body: bytes,
        contentLength: prepared.sizeBytes,
        mimeType,
        checksumSha256: prepared.checksumSha256,
      });
      return prepared;
    } catch (error) {
      this.logger.error(
        { fileId, provider: prepared.provider, errorType: errorName(error) },
        'Processed file write failed',
      );
      throw new AppException('FILE_STORAGE_UNAVAILABLE');
    }
  }

  public async discardPrepared(prepared: PreparedFileContent): Promise<void> {
    try {
      await this.providers.resolve(prepared.provider).delete(prepared.storageKey);
    } catch (error) {
      this.logger.error(
        { fileId: prepared.fileId, provider: prepared.provider, errorType: errorName(error) },
        'Unclaimed processed file cleanup failed',
      );
    }
  }

  public async claimPrepared(transaction: FileClaimTransaction): Promise<PublicFileDescriptor> {
    const file = await this.repository.findByIdForUpdate(
      transaction.manager,
      transaction.prepared.fileId,
    );
    this.assertClaimable(file, transaction.uploaderId, transaction.purpose);
    if (file.provider !== transaction.prepared.provider) {
      throw new AppException('FILE_STORAGE_UNAVAILABLE');
    }
    const descriptor = await this.repository.claimPrepared(
      transaction.manager,
      file,
      transaction.prepared,
    );
    return { ...descriptor, url: this.toAbsolutePublicUrl(descriptor.url) };
  }

  public async markDeletingForOwner(
    manager: FileClaimTransaction['manager'],
    fileId: string,
    uploaderId: string,
    purpose: string,
  ): Promise<void> {
    const file = await this.repository.findByIdForUpdate(manager, fileId);
    if (!file) return;
    if (file.uploadedBy !== uploaderId || file.purpose !== purpose) {
      throw new AppException('FILE_OWNERSHIP_MISMATCH');
    }
    await this.repository.markDeletingInTransaction(manager, file.id);
  }

  public findPublicDescriptors(ids: readonly string[]): Promise<PublicFileDescriptor[]> {
    return this.repository
      .findReadyPublicByIds(ids)
      .then((descriptors) => descriptors.map((descriptor) => this.toPublicDescriptor(descriptor)));
  }

  public async enqueueClaimCleanup(
    claimedFileId: string,
    replacedFileId: string | null,
    correlationId: string,
  ): Promise<void> {
    const tasks = [this.enqueueMigrationSourceDeletion(claimedFileId, correlationId)];
    if (replacedFileId) tasks.push(this.enqueueDeletion(replacedFileId, correlationId));
    const results = await Promise.allSettled(tasks);
    if (results.some(({ status }) => status === 'rejected')) {
      this.logger.error(
        { fileId: claimedFileId, correlationId },
        'File cleanup enqueue will be recovered by the sweeper',
      );
    }
  }

  private toPublicDescriptor(descriptor: PublicFileDescriptor): PublicFileDescriptor {
    return { ...descriptor, url: this.toAbsolutePublicUrl(descriptor.url) };
  }

  private toAbsolutePublicUrl(url: string): string {
    return new URL(url, `${this.appBaseUrl}/`).toString();
  }

  public async getPublicAccess(publicId: string): Promise<PublicFileAccess> {
    const file = await this.repository.findPublic(publicId);
    if (!file) throw new AppException('FILE_NOT_FOUND');
    const provider = this.providers.resolve(file.provider);
    try {
      const url = await provider.signedDownloadUrl(
        file.storageKey,
        file.mimeType,
        this.signedUrlTtlSeconds,
      );
      if (url) return { kind: 'redirect', url };
      return {
        kind: 'stream',
        stream: await provider.read(file.storageKey),
        mimeType: file.mimeType,
        sizeBytes: file.sizeBytes,
        checksumSha256: file.checksumSha256,
      };
    } catch (error) {
      this.logger.error(
        { fileId: file.id, provider: file.provider, errorType: errorName(error) },
        'Public file access failed',
      );
      throw new AppException('FILE_STORAGE_UNAVAILABLE');
    }
  }

  public async enqueueDeletion(fileId: string, correlationId: string): Promise<void> {
    await this.queue.add(
      FILE_DELETE_JOB,
      { fileId, correlationId },
      {
        jobId: `file-delete-${fileId}`,
        attempts: this.maxRetries,
        backoff: { type: 'exponential', delay: this.retryDelayMs },
        removeOnComplete: { age: 3600 },
        removeOnFail: { age: 86_400 },
      },
    );
  }

  public async scheduleDeletion(fileId: string, correlationId: string): Promise<void> {
    try {
      await this.enqueueDeletion(fileId, correlationId);
    } catch (error) {
      this.logger.error(
        { fileId, correlationId, errorType: errorName(error) },
        'File deletion enqueue will be recovered by the sweeper',
      );
    }
  }

  public async deletePhysicalFile(fileId: string): Promise<void> {
    const file = await this.repository.findById(fileId);
    if (!file) return;
    const provider = this.providers.resolve(file.provider);
    try {
      if (file.storageKey === file.id) {
        await (await provider.tusStore()).remove(file.id);
        // Recover a processed object left behind if the API stopped after image
        // sanitization but before the transactional file claim.
        await provider.delete(`ready/${file.id}`);
      } else {
        await provider.delete(file.storageKey);
      }
      await this.repository.removeMetadata(file.id);
    } catch (error) {
      await this.repository.recordDeleteFailure(file.id, 'FILE_DELETE_FAILED');
      throw error;
    }
  }

  public async deleteMigrationSource(fileId: string): Promise<void> {
    const file = await this.repository.findById(fileId);
    if (!file?.pendingDeleteProvider || !file.pendingDeleteStorageKey) return;
    const provider = this.providers.resolve(file.pendingDeleteProvider);
    if (file.pendingDeleteStorageKey === file.id) {
      await (await provider.tusStore()).remove(file.id);
    } else {
      await provider.delete(file.pendingDeleteStorageKey);
    }
    await this.repository.clearPendingMigrationSource(file.id);
  }

  public async enqueueMigrationSourceDeletion(
    fileId: string,
    correlationId: string,
  ): Promise<void> {
    await this.queue.add(
      FILE_MIGRATION_SOURCE_DELETE_JOB,
      { fileId, correlationId },
      {
        jobId: `file-migration-source-delete-${fileId}`,
        attempts: this.maxRetries,
        backoff: { type: 'exponential', delay: this.retryDelayMs },
        removeOnComplete: { age: 3600 },
        removeOnFail: { age: 86_400 },
      },
    );
  }

  public sweepExpired(correlationId: string): Promise<number> {
    return this.repository.withCleanupLock(async () => {
      const candidates = await this.repository.findCleanupCandidates(new Date(), 100);
      const migrationSources = await this.repository.findPendingMigrationSourceCleanup(100);
      for (const file of candidates) {
        if (file.status !== 'deleting') await this.repository.markDeleting(file.id);
        try {
          await this.enqueueDeletion(file.id, file.correlationId || correlationId);
        } catch (error) {
          this.logger.error(
            {
              fileId: file.id,
              provider: file.provider,
              correlationId: file.correlationId || correlationId,
              errorType: errorName(error),
            },
            'File cleanup enqueue failed',
          );
        }
      }
      for (const file of migrationSources) {
        try {
          await this.enqueueMigrationSourceDeletion(file.id, file.correlationId || correlationId);
        } catch (error) {
          this.logger.error(
            {
              fileId: file.id,
              provider: file.pendingDeleteProvider,
              correlationId: file.correlationId || correlationId,
              errorType: errorName(error),
            },
            'Migrated source cleanup enqueue failed',
          );
        }
      }
      return candidates.length + migrationSources.length;
    });
  }

  public async checkStorageHealth(): Promise<void> {
    await Promise.all(this.providers.enabled().map((provider) => provider.checkHealth()));
  }

  private assertClaimable(
    file: StoredFile | null,
    uploaderId: string,
    purpose: string,
  ): asserts file is StoredFile {
    if (!file) throw new AppException('FILE_NOT_FOUND');
    if (file.uploadedBy !== uploaderId) throw new AppException('FILE_OWNERSHIP_MISMATCH');
    if (file.purpose !== purpose) throw new AppException('FILE_TYPE_NOT_ALLOWED');
    if (file.expiresAt.getTime() <= Date.now()) throw new AppException('FILE_UPLOAD_EXPIRED');
    if (file.status !== 'uploaded') throw new AppException('FILE_NOT_READY');
  }
}

class TusHookError extends Error {
  public readonly status_code: number;
  public readonly body: string;

  public constructor(
    statusCode: number,
    public readonly code: string,
  ) {
    super(code);
    this.status_code = statusCode;
    this.body = JSON.stringify({ code, message: messageForTusCode(code) });
  }
}

function uploadIdFromPath(requestPath: string, basePath: string): string | null {
  const normalized = requestPath.replace(/\/+$/, '');
  const base = basePath.replace(/\/+$/, '');
  if (normalized === base) return null;
  const candidate = normalized.slice(base.length + 1);
  return /^[0-9a-f-]{36}$/i.test(candidate) ? candidate : null;
}

function normalizeFilename(value: string | null | undefined): string {
  if (!value) throw new TusHookError(400, 'BAD_REQUEST');
  const normalized = stripControlCharacters(path.basename(value)).trim();
  if (normalized.length === 0 || normalized.length > 255) {
    throw new TusHookError(400, 'BAD_REQUEST');
  }
  return normalized;
}

function stripControlCharacters(value: string): string {
  return Array.from(value)
    .filter((character) => {
      const codePoint = character.codePointAt(0) ?? 0;
      return codePoint > 31 && codePoint !== 127;
    })
    .join('');
}

function codeForTusStatus(statusCode: number): string {
  if (statusCode === 409) return 'FILE_OFFSET_MISMATCH';
  if (statusCode === 412) return 'TUS_VERSION_UNSUPPORTED';
  if (statusCode === 410) return 'FILE_UPLOAD_EXPIRED';
  if (statusCode === 413) return 'FILE_TOO_LARGE';
  if (statusCode === 415) return 'FILE_TYPE_NOT_ALLOWED';
  if (statusCode === 401) return 'UNAUTHORIZED';
  if (statusCode === 404) return 'FILE_NOT_FOUND';
  return statusCode < 500 ? 'BAD_REQUEST' : 'FILE_STORAGE_UNAVAILABLE';
}

function messageForTusCode(code: string): string {
  const messages: Record<string, string> = {
    BAD_REQUEST: 'The request could not be processed',
    FILE_NOT_FOUND: 'The requested file was not found',
    FILE_OFFSET_MISMATCH: 'The upload offset does not match the stored offset',
    FILE_OWNERSHIP_MISMATCH: 'The file does not belong to the authenticated user',
    FILE_STORAGE_UNAVAILABLE: 'File storage is temporarily unavailable',
    FILE_TOO_LARGE: 'The file exceeds the allowed size',
    FILE_TYPE_NOT_ALLOWED: 'The file type is not allowed',
    FILE_UPLOAD_EXPIRED: 'The file upload has expired',
    TUS_VERSION_UNSUPPORTED: 'The tus protocol version is not supported',
    UNAUTHORIZED: 'Authentication is required',
  };
  return messages[code] ?? 'The request could not be processed';
}

function errorName(error: unknown): string {
  return error instanceof Error ? error.name : 'UnknownError';
}

function sha256Stream(stream: Readable): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = createHash('sha256');
    stream.on('data', (chunk: Buffer | string) => {
      hash.update(chunk);
    });
    stream.once('end', () => {
      resolve(hash.digest('hex'));
    });
    stream.once('error', reject);
  });
}

class FileTooLargeStreamError extends Error {}

function readBounded(stream: Readable, maximumBytes: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let total = 0;
    stream.on('data', (chunk: Buffer | string) => {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      total += buffer.byteLength;
      if (total > maximumBytes) {
        stream.destroy(new FileTooLargeStreamError());
        return;
      }
      chunks.push(buffer);
    });
    stream.once('end', () => {
      resolve(Buffer.concat(chunks, total));
    });
    stream.once('error', reject);
  });
}
