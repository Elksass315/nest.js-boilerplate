import { Readable } from 'node:stream';

import type { ConfigService } from '@nestjs/config';
import type { PinoLogger } from 'nestjs-pino';

import type { AppConfiguration, FilesConfig } from '@/config/configuration.types';
import { AppException } from '@/core/errors/app.exception';
import type { OutboxRepository } from '@/core/outbox/outbox.repository';
import type { DataSource } from 'typeorm';

import type { FilesRepository } from './files.repository';
import { FilesService } from './files.service';
import type { StoredFile, StorageProvider } from './files.types';
import type { StorageProviderFactory } from './providers/storage-provider.factory';
import type { RedisTusLocker } from './redis-tus-locker';

describe(FilesService.name, () => {
  const repository = {
    findById: jest.fn(),
    findPublic: jest.fn(),
    markDeleting: jest.fn(),
    recordDeleteFailure: jest.fn(),
    removeMetadata: jest.fn(),
    clearPendingMigrationSource: jest.fn(),
    withCleanupLock: jest.fn((work: () => Promise<unknown>) => work()),
    findCleanupCandidates: jest.fn(),
    findPendingMigrationSourceCleanup: jest.fn(),
    findByIdForUpdate: jest.fn(),
    findReadyPublicByIds: jest.fn(),
    claimPrepared: jest.fn(),
    markDeletingInTransaction: jest.fn(),
  };
  const local = provider();
  const providers = {
    resolve: jest.fn(() => local),
    enabled: jest.fn(() => [local]),
  };
  const outbox = { insert: jest.fn() };
  const dataSource = {
    transaction: jest.fn(async (work: (manager: object) => Promise<unknown>) => work({})),
  };
  const logger = { setContext: jest.fn(), info: jest.fn(), error: jest.fn() };
  const filesConfig = {
    writeDriver: 'local',
    uploadExpirationMs: 86_400_000,
    signedUrlTtlSeconds: 300,
    maxRetries: 5,
    retryDelayMs: 30_000,
  } as FilesConfig;
  let service: FilesService;

  beforeEach(() => {
    jest.clearAllMocks();
    const config = {
      getOrThrow: jest.fn((key: string) =>
        key === 'app.baseUrl' ? 'https://api.example.test' : filesConfig,
      ),
    } as unknown as ConfigService<AppConfiguration, true>;
    service = new FilesService(
      config,
      repository as unknown as FilesRepository,
      providers as unknown as StorageProviderFactory,
      {} as RedisTusLocker,
      outbox as unknown as OutboxRepository,
      dataSource as unknown as DataSource,
      logger as unknown as PinoLogger,
    );
    repository.findCleanupCandidates.mockResolvedValue([]);
    repository.findPendingMigrationSourceCleanup.mockResolvedValue([]);
  });

  it('returns a signed redirect for a public S3-style object', async () => {
    repository.findPublic.mockResolvedValue(storedFile());
    local.signedDownloadUrl.mockResolvedValue('https://objects.example/file');
    await expect(service.getPublicAccess('public-id')).resolves.toEqual({
      kind: 'redirect',
      url: 'https://objects.example/file',
    });
  });

  it('streams a public local object with safe metadata', async () => {
    repository.findPublic.mockResolvedValue(storedFile());
    local.signedDownloadUrl.mockResolvedValue(null);
    local.read.mockResolvedValue(Readable.from('avatar'));
    await expect(service.getPublicAccess('public-id')).resolves.toEqual(
      expect.objectContaining({
        kind: 'stream',
        mimeType: 'image/png',
        sizeBytes: '6',
      }),
    );
  });

  it('hides unavailable and protected files behind stable errors', async () => {
    repository.findPublic.mockResolvedValue(null);
    await expect(service.getPublicAccess('missing')).rejects.toBeInstanceOf(AppException);

    repository.findPublic.mockResolvedValue(storedFile());
    local.signedDownloadUrl.mockRejectedValue(new Error('provider unavailable'));
    await expect(service.getPublicAccess('public-id')).rejects.toBeInstanceOf(AppException);
    expect(logger.error).toHaveBeenCalled();
  });

  it('returns absolute public URLs from the configured application base URL', async () => {
    repository.findReadyPublicByIds.mockResolvedValue([
      {
        fileId: 'file-1',
        publicId: 'public-1',
        url: '/api/v1/files/public/public-1',
        mimeType: 'image/png',
        sizeBytes: 9,
      },
    ]);

    await expect(service.findPublicDescriptors(['file-1'])).resolves.toEqual([
      expect.objectContaining({ url: 'https://api.example.test/api/v1/files/public/public-1' }),
    ]);
  });

  it('enqueues bounded correlated deletion jobs', async () => {
    await service.enqueueDeletion('file-1', 'correlation-1');
    expect(outbox.insert).toHaveBeenCalledWith(
      expect.anything(),
      'file.delete',
      { fileId: 'file-1', correlationId: 'correlation-1' },
      'correlation-1',
    );
  });

  it('writes both avatar cleanup requests through one caller transaction', async () => {
    await service.enqueueClaimCleanup('file-1', 'old-file', 'correlation-1', {} as never);

    expect(outbox.insert).toHaveBeenNthCalledWith(
      1,
      expect.anything(),
      'file.migration-source-delete',
      { fileId: 'file-1', correlationId: 'correlation-1' },
      'correlation-1',
    );
    expect(outbox.insert).toHaveBeenNthCalledWith(
      2,
      expect.anything(),
      'file.delete',
      { fileId: 'old-file', correlationId: 'correlation-1' },
      'correlation-1',
    );
  });

  it('deletes tus data and metadata idempotently', async () => {
    repository.findById.mockResolvedValue(storedFile());
    await service.deletePhysicalFile('file-1');
    expect((await local.tusStore()).remove).toHaveBeenCalledWith('file-1');
    expect(repository.removeMetadata).toHaveBeenCalledWith('file-1');

    repository.findById.mockResolvedValue(null);
    await expect(service.deletePhysicalFile('file-1')).resolves.toBeUndefined();
  });

  it('marks failed physical deletion for retry observability', async () => {
    repository.findById.mockResolvedValue(storedFile());
    jest
      .mocked((await local.tusStore()).remove)
      .mockRejectedValue(new Error('storage unavailable'));
    await expect(service.deletePhysicalFile('file-1')).rejects.toThrow('storage unavailable');
    expect(repository.recordDeleteFailure).toHaveBeenCalledWith('file-1', 'FILE_DELETE_FAILED');
  });

  it('sweeps expired files and pending migration sources with stored correlations', async () => {
    repository.findCleanupCandidates.mockResolvedValue([storedFile({ status: 'uploaded' })]);
    repository.findPendingMigrationSourceCleanup.mockResolvedValue([
      storedFile({ pendingDeleteProvider: 's3', pendingDeleteStorageKey: 'old-key' }),
    ]);
    await expect(service.sweepExpired('sweeper-correlation')).resolves.toBe(2);
    expect(repository.markDeleting).toHaveBeenCalledWith('file-1', expect.anything());
    expect(outbox.insert).toHaveBeenCalledTimes(2);
  });

  it('deletes a deferred migration source and checks all enabled providers', async () => {
    repository.findById.mockResolvedValue(
      storedFile({ pendingDeleteProvider: 's3', pendingDeleteStorageKey: 'old-key' }),
    );
    await service.deleteMigrationSource('file-1');
    expect(local.delete).toHaveBeenCalledWith('old-key');
    expect(repository.clearPendingMigrationSource).toHaveBeenCalledWith('file-1');
    await service.checkStorageHealth();
    expect(local.checkHealth).toHaveBeenCalled();
  });

  it('reads, stages, and atomically claims bounded owned upload content', async () => {
    const upload = storedFile({
      status: 'uploaded',
      visibility: 'protected',
      expiresAt: new Date('2099-08-15T00:00:00Z'),
    });
    repository.findById.mockResolvedValue(upload);
    repository.findByIdForUpdate.mockResolvedValue(upload);
    local.read.mockResolvedValue(Readable.from('avatar'));
    local.exists.mockResolvedValue(false);
    local.write.mockResolvedValue(undefined);
    repository.claimPrepared.mockResolvedValue({
      fileId: upload.id,
      publicId: upload.publicId,
      url: `http://localhost:3000/api/v1/files/public/${upload.publicId}`,
      mimeType: 'image/png',
      sizeBytes: 9,
    });

    const content = await service.readUploadedForOwner(
      upload.id,
      upload.uploadedBy,
      upload.purpose,
      10,
    );
    const prepared = await service.prepareReplacement(
      upload.id,
      upload.uploadedBy,
      upload.purpose,
      Buffer.from('sanitized'),
      'image/png',
    );
    await service.claimPrepared({
      manager: {} as never,
      prepared,
      uploaderId: upload.uploadedBy,
      purpose: upload.purpose,
    });

    expect(content.bytes.toString()).toBe('avatar');
    expect(prepared.storageKey).toBe('ready/file-1');
    expect(local.write).toHaveBeenCalledWith(
      expect.objectContaining({ key: prepared.storageKey, checksumSha256: expect.any(String) }),
    );
    expect(repository.claimPrepared).toHaveBeenCalled();
  });

  it('reuses a matching recoverable processed object after interruption', async () => {
    const upload = storedFile({
      status: 'uploaded',
      visibility: 'protected',
      expiresAt: new Date('2099-08-15T00:00:00Z'),
    });
    repository.findById.mockResolvedValue(upload);
    local.exists.mockResolvedValue(true);
    local.read.mockResolvedValue(Readable.from('sanitized'));

    await expect(
      service.prepareReplacement(
        upload.id,
        upload.uploadedBy,
        upload.purpose,
        Buffer.from('sanitized'),
        'image/png',
      ),
    ).resolves.toEqual(expect.objectContaining({ storageKey: 'ready/file-1' }));
    expect(local.write).not.toHaveBeenCalled();
  });

  it('rejects ownership and size violations before processing storage bytes', async () => {
    repository.findById.mockResolvedValue(
      storedFile({ status: 'uploaded', expiresAt: new Date('2099-08-15T00:00:00Z') }),
    );
    await expect(
      service.readUploadedForOwner('file-1', 'other-user', 'user_avatar', 10),
    ).rejects.toBeInstanceOf(AppException);
    await expect(
      service.readUploadedForOwner('file-1', 'user-1', 'user_avatar', 1),
    ).rejects.toBeInstanceOf(AppException);
    expect(local.read).not.toHaveBeenCalled();
  });

  it('keeps enqueue failures recoverable after database commit', async () => {
    outbox.insert.mockRejectedValueOnce(new Error('database unavailable'));
    await expect(service.scheduleDeletion('file-1', 'correlation-1')).resolves.toBeUndefined();
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ fileId: 'file-1', correlationId: 'correlation-1' }),
      expect.stringContaining('recovered by the sweeper'),
    );
  });
});

function provider(): jest.Mocked<StorageProvider> {
  return {
    driver: 'local',
    tusStore: jest.fn().mockResolvedValue({ remove: jest.fn() }),
    read: jest.fn(),
    write: jest.fn(),
    delete: jest.fn(),
    exists: jest.fn(),
    signedDownloadUrl: jest.fn(),
    checkHealth: jest.fn(),
  };
}

function storedFile(overrides: Partial<StoredFile> = {}): StoredFile {
  return {
    id: 'file-1',
    publicId: 'public-id',
    provider: 'local',
    storageKey: 'file-1',
    originalName: 'avatar.png',
    mimeType: 'image/png',
    sizeBytes: '6',
    checksumSha256: 'checksum',
    visibility: 'public',
    status: 'ready',
    purpose: 'user_avatar',
    uploadedBy: 'user-1',
    expiresAt: new Date('2026-08-15T00:00:00Z'),
    completedAt: new Date('2026-08-14T00:00:00Z'),
    claimedAt: new Date('2026-08-14T00:01:00Z'),
    deleteRequestedAt: null,
    failureCode: null,
    pendingDeleteProvider: null,
    pendingDeleteStorageKey: null,
    requestId: 'request-1',
    correlationId: 'correlation-1',
    ...overrides,
  };
}
