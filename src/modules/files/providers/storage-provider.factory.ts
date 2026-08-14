import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { AppConfiguration, FileStorageDriver } from '@/config/configuration.types';

import type { StorageProvider } from '../files.types';
import { LocalStorageProvider } from './local-storage.provider';
import { S3StorageProvider } from './s3-storage.provider';

@Injectable()
export class StorageProviderFactory {
  private readonly enabledDrivers: ReadonlySet<FileStorageDriver>;

  public constructor(
    config: ConfigService<AppConfiguration, true>,
    private readonly local: LocalStorageProvider,
    private readonly s3: S3StorageProvider,
  ) {
    this.enabledDrivers = new Set(config.getOrThrow('files.readDrivers', { infer: true }));
  }

  public resolve(driver: FileStorageDriver): StorageProvider {
    if (!this.enabledDrivers.has(driver))
      throw new Error(`Storage provider ${driver} is not enabled`);
    return driver === 'local' ? this.local : this.s3;
  }

  public enabled(): StorageProvider[] {
    return [...this.enabledDrivers].map((driver) => this.resolve(driver));
  }
}
