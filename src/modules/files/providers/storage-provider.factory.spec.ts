import type { ConfigService } from '@nestjs/config';

import type { AppConfiguration } from '@/config/configuration.types';

import type { LocalStorageProvider } from './local-storage.provider';
import type { S3StorageProvider } from './s3-storage.provider';
import { StorageProviderFactory } from './storage-provider.factory';

describe(StorageProviderFactory.name, () => {
  const local = { driver: 'local' } as LocalStorageProvider;
  const s3 = { driver: 's3' } as S3StorageProvider;

  function create(readDrivers: ('local' | 's3')[]): StorageProviderFactory {
    const config = {
      getOrThrow: jest.fn(() => readDrivers),
    } as unknown as ConfigService<AppConfiguration, true>;
    return new StorageProviderFactory(config, local, s3);
  }

  it('resolves every configured read provider', () => {
    const factory = create(['local', 's3']);
    expect(factory.resolve('local')).toBe(local);
    expect(factory.resolve('s3')).toBe(s3);
    expect(factory.enabled()).toEqual([local, s3]);
  });

  it('rejects a provider that was not enabled for reads', () => {
    expect(() => create(['local']).resolve('s3')).toThrow('Storage provider s3 is not enabled');
  });
});
