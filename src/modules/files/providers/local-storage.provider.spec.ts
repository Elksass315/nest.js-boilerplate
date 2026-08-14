import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { Readable } from 'node:stream';

import type { ConfigService } from '@nestjs/config';

import type { AppConfiguration, FilesConfig } from '@/config/configuration.types';

import { LocalStorageProvider } from './local-storage.provider';

describe(LocalStorageProvider.name, () => {
  let root: string;
  let provider: LocalStorageProvider;

  beforeEach(async () => {
    root = await mkdtemp(path.join(tmpdir(), 'files-provider-'));
    const files = { localRoot: root, uploadExpirationMs: 60_000 } as FilesConfig;
    const config = { getOrThrow: jest.fn(() => files) } as unknown as ConfigService<
      AppConfiguration,
      true
    >;
    provider = new LocalStorageProvider(config);
  });

  afterEach(async () => rm(root, { recursive: true, force: true }));

  it('writes, reads, detects, and deletes byte arrays', async () => {
    await provider.write({
      key: 'objects/example',
      body: Buffer.from('avatar'),
      contentLength: 6,
      mimeType: 'image/png',
    });
    expect(await provider.exists('objects/example')).toBe(true);
    const chunks: Buffer[] = [];
    for await (const chunk of await provider.read('objects/example'))
      chunks.push(Buffer.from(chunk));
    expect(Buffer.concat(chunks).toString()).toBe('avatar');
    await provider.delete('objects/example');
    expect(await provider.exists('objects/example')).toBe(false);
  });

  it('writes streams and verifies the storage root health', async () => {
    await provider.write({
      key: 'streamed',
      body: Readable.from('content'),
      contentLength: 7,
      mimeType: 'application/octet-stream',
    });
    await expect(provider.checkHealth()).resolves.toBeUndefined();
    await expect(provider.signedDownloadUrl()).resolves.toBeNull();
  });

  it.each(['../escape', '/absolute', 'nested//empty', 'nested/../escape'])(
    'rejects unsafe storage key %s',
    async (key) => {
      await expect(provider.read(key)).rejects.toThrow('Unsafe storage key');
    },
  );
});
