import { Readable } from 'node:stream';

import type { PinoLogger } from 'nestjs-pino';
import type { DataSource } from 'typeorm';

import type { OutboxRepository } from '@/core/outbox/outbox.repository';
import type { FilesRepository } from './files.repository';
import { FilesMigrationService } from './files-migration.service';
import type { StoredFile, StorageProvider } from './files.types';
import type { StorageProviderFactory } from './providers/storage-provider.factory';

const contents = Buffer.from('avatar');
const checksum = '87bbe879c7a5f5784a70384bb49fa9513a6a3fbe4c2d388635e3c87611c03fae';

describe(FilesMigrationService.name, () => {
  const file: StoredFile = {
    id: '11111111-1111-4111-8111-111111111111',
    publicId: '22222222-2222-4222-8222-222222222222',
    provider: 'local',
    storageKey: 'upload-key',
    originalName: 'example.png',
    mimeType: 'image/png',
    sizeBytes: '6',
    checksumSha256: checksum,
    visibility: 'public',
    status: 'ready',
    purpose: 'user_avatar',
    uploadedBy: '33333333-3333-4333-8333-333333333333',
    expiresAt: new Date('2026-08-15T00:00:00Z'),
    completedAt: new Date('2026-08-14T00:00:00Z'),
    claimedAt: new Date('2026-08-14T00:01:00Z'),
    deleteRequestedAt: null,
    failureCode: null,
    pendingDeleteProvider: null,
    pendingDeleteStorageKey: null,
    requestId: 'request-1',
    correlationId: 'correlation-1',
  };
  const repository = {
    countByProvider: jest.fn(),
    withMigrationLock: jest.fn((work: () => Promise<unknown>) => work()),
    findMigrationBatch: jest.fn(),
    switchProvider: jest.fn(),
    clearPendingMigrationSource: jest.fn(),
  };
  const outbox = { insert: jest.fn() };
  const dataSource = {
    transaction: jest.fn(async (work: (manager: object) => Promise<unknown>) => work({})),
  };
  const source = provider('local');
  const target = provider('s3');
  const providers = {
    resolve: jest.fn((driver: 'local' | 's3') => (driver === 'local' ? source : target)),
  };
  const logger = { setContext: jest.fn(), warn: jest.fn() };
  let service: FilesMigrationService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new FilesMigrationService(
      repository as unknown as FilesRepository,
      providers as unknown as StorageProviderFactory,
      outbox as unknown as OutboxRepository,
      logger as unknown as PinoLogger,
      dataSource as unknown as DataSource,
    );
    repository.findMigrationBatch.mockResolvedValueOnce([file]).mockResolvedValueOnce([]);
    repository.switchProvider.mockResolvedValue(true);
    source.read.mockResolvedValue(Readable.from(contents));
    target.read.mockResolvedValue(Readable.from(contents));
    target.exists.mockResolvedValue(false);
    target.write.mockImplementation(async (input) => {
      if (!(input.body instanceof Uint8Array)) {
        for await (const chunk of input.body) {
          void chunk;
          // Consume the source so the checksum transform completes like a real provider write.
        }
      }
    });
  });

  it('reports per-provider counts', async () => {
    repository.countByProvider.mockResolvedValueOnce(2).mockResolvedValueOnce(3);
    await expect(service.status()).resolves.toEqual({ local: 2, s3: 3 });
  });

  it('dry-runs without copying or switching rows', async () => {
    await expect(
      service.migrate({ from: 'local', to: 's3', dryRun: true, confirmed: false, batchSize: 25 }),
    ).resolves.toEqual({ examined: 1, migrated: 0, dryRun: true });
    expect(target.write).not.toHaveBeenCalled();
    expect(repository.switchProvider).not.toHaveBeenCalled();
  });

  it('copies, verifies, switches, then deletes the source', async () => {
    await expect(
      service.migrate({ from: 'local', to: 's3', dryRun: false, confirmed: true, batchSize: 25 }),
    ).resolves.toEqual({ examined: 1, migrated: 1, dryRun: false });
    expect(target.write).toHaveBeenCalledWith(
      expect.objectContaining({ key: `objects/${file.id}`, contentLength: 6 }),
    );
    expect(repository.switchProvider).toHaveBeenCalledWith(
      file.id,
      'local',
      's3',
      `objects/${file.id}`,
      expect.anything(),
    );
    expect(outbox.insert).toHaveBeenCalledWith(
      expect.anything(),
      'file.migration-source-delete',
      { fileId: file.id, correlationId: file.correlationId },
      file.correlationId,
    );
    expect(source.delete).toHaveBeenCalledWith(file.storageKey);
  });

  it('requires confirmation and distinct providers', () => {
    expect(() =>
      service.migrate({ from: 'local', to: 's3', dryRun: false, confirmed: false, batchSize: 25 }),
    ).toThrow('requires --confirm');
    expect(() =>
      service.migrate({
        from: 'local',
        to: 'local',
        dryRun: true,
        confirmed: false,
        batchSize: 25,
      }),
    ).toThrow('must differ');
  });
});

function provider(driver: 'local' | 's3'): jest.Mocked<StorageProvider> {
  return {
    driver,
    tusStore: jest.fn().mockResolvedValue({ remove: jest.fn() }),
    read: jest.fn(),
    write: jest.fn(),
    delete: jest.fn(),
    exists: jest.fn(),
    signedDownloadUrl: jest.fn(),
    checkHealth: jest.fn(),
  };
}
