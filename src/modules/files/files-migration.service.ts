import { createHash } from 'node:crypto';
import { Transform, type TransformCallback } from 'node:stream';

import { Injectable } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';

import { FilesRepository } from './files.repository';
import type {
  FileMigrationOptions,
  FileMigrationResult,
  StoredFile,
  StorageProvider,
} from './files.types';
import { StorageProviderFactory } from './providers/storage-provider.factory';

@Injectable()
export class FilesMigrationService {
  public constructor(
    private readonly repository: FilesRepository,
    private readonly providers: StorageProviderFactory,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(FilesMigrationService.name);
  }

  public async status(): Promise<{ local: number; s3: number }> {
    const [local, s3] = await Promise.all([
      this.repository.countByProvider('local'),
      this.repository.countByProvider('s3'),
    ]);
    return { local, s3 };
  }

  public migrate(options: FileMigrationOptions): Promise<FileMigrationResult> {
    validateMigrationOptions(options);
    const source = this.providers.resolve(options.from);
    const target = this.providers.resolve(options.to);
    return this.repository.withMigrationLock(() => this.runBatches(options, source, target));
  }

  private async runBatches(
    options: FileMigrationOptions,
    source: StorageProvider,
    target: StorageProvider,
  ): Promise<FileMigrationResult> {
    let afterId: string | null = null;
    let examined = 0;
    let migrated = 0;
    let hasMore = true;
    while (hasMore) {
      const files = await this.repository.findMigrationBatch(
        options.from,
        afterId,
        options.batchSize,
      );
      if (files.length === 0) {
        hasMore = false;
        continue;
      }
      for (const file of files) {
        examined += 1;
        afterId = file.id;
        if (!options.dryRun) {
          await this.migrateOne(file, source, target);
          migrated += 1;
        }
      }
    }
    return { examined, migrated, dryRun: options.dryRun };
  }

  private async migrateOne(
    file: StoredFile,
    source: StorageProvider,
    target: StorageProvider,
  ): Promise<void> {
    if (!file.checksumSha256) throw new Error('Completed file is missing a checksum');
    const targetKey = `objects/${file.id}`;
    if (await target.exists(targetKey)) {
      await verifyStoredObject(target, targetKey, file);
    } else {
      const meter = new ChecksumTransform();
      const sourceStream = await source.read(file.storageKey);
      await target.write({
        key: targetKey,
        body: sourceStream.pipe(meter),
        contentLength: Number(file.sizeBytes),
        mimeType: file.mimeType,
        checksumSha256: Buffer.from(file.checksumSha256, 'hex').toString('base64'),
      });
      if (meter.bytes !== Number(file.sizeBytes) || meter.digest() !== file.checksumSha256) {
        throw new Error('Source object failed size or checksum verification');
      }
      await verifyStoredObject(target, targetKey, file);
    }
    if (!(await this.repository.switchProvider(file.id, source.driver, target.driver, targetKey))) {
      throw new Error('File provider changed during migration');
    }
    try {
      if (file.storageKey === file.id) {
        await (await source.tusStore()).remove(file.id);
      } else {
        await source.delete(file.storageKey);
      }
      await this.repository.clearPendingMigrationSource(file.id);
    } catch (error) {
      this.logger.warn(
        { fileId: file.id, provider: source.driver, errorType: errorName(error) },
        'Migrated source cleanup deferred to the file worker',
      );
    }
  }
}

class ChecksumTransform extends Transform {
  private readonly hash = createHash('sha256');
  public bytes = 0;

  public override _transform(
    chunk: Buffer,
    _encoding: BufferEncoding,
    callback: TransformCallback,
  ): void {
    this.bytes += chunk.length;
    this.hash.update(chunk);
    callback(null, chunk);
  }

  public digest(): string {
    return this.hash.digest('hex');
  }
}

async function verifyStoredObject(
  provider: StorageProvider,
  key: string,
  expected: StoredFile,
): Promise<void> {
  const meter = new ChecksumTransform();
  const stream = await provider.read(key);
  await new Promise<void>((resolve, reject) => {
    stream
      .pipe(meter)
      .on('data', () => undefined)
      .once('end', resolve)
      .once('error', reject);
    stream.once('error', reject);
  });
  if (meter.bytes !== Number(expected.sizeBytes) || meter.digest() !== expected.checksumSha256) {
    throw new Error('Target object exists with a mismatched size or checksum');
  }
}

function validateMigrationOptions(options: FileMigrationOptions): void {
  if (options.from === options.to) throw new Error('Source and target providers must differ');
  if (!options.dryRun && !options.confirmed) {
    throw new Error('Provider migration requires --confirm unless --dry-run is used');
  }
  if (!Number.isInteger(options.batchSize) || options.batchSize < 1 || options.batchSize > 100) {
    throw new Error('Migration batch size must be an integer from 1 to 100');
  }
}

function errorName(error: unknown): string {
  return error instanceof Error ? error.name : 'UnknownError';
}
