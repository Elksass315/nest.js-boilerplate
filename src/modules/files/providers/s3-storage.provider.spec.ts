import { Readable } from 'node:stream';

import { S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type { ConfigService } from '@nestjs/config';

import type { AppConfiguration, FilesConfig } from '@/config/configuration.types';

import { S3StorageProvider } from './s3-storage.provider';

jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: jest.fn(),
}));

describe(S3StorageProvider.name, () => {
  const send = jest.spyOn(S3Client.prototype, 'send') as unknown as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('writes, reads, deletes, and health-checks private encrypted objects', async () => {
    const provider = createProvider();
    send
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({
        Body: { transformToWebStream: () => Readable.toWeb(Readable.from('avatar')) },
      })
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({});
    await provider.write({
      key: 'objects/file',
      body: Buffer.from('avatar'),
      contentLength: 6,
      mimeType: 'image/png',
      checksumSha256: '00'.repeat(32),
    });
    const chunks: Buffer[] = [];
    for await (const chunk of await provider.read('objects/file')) chunks.push(Buffer.from(chunk));
    expect(Buffer.concat(chunks).toString()).toBe('avatar');
    await provider.delete('objects/file');
    await provider.checkHealth();
    expect(send).toHaveBeenCalledTimes(4);
    expect(send).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        input: expect.objectContaining({
          ChecksumSHA256: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=',
        }),
      }),
    );
  });

  it('rejects malformed SHA-256 checksums before writing', async () => {
    await expect(
      createProvider().write({
        key: 'objects/file',
        body: Buffer.from('avatar'),
        contentLength: 6,
        mimeType: 'image/png',
        checksumSha256: 'not-a-sha256',
      }),
    ).rejects.toThrow('Invalid SHA-256 checksum');
    expect(send).not.toHaveBeenCalled();
  });

  it('distinguishes a missing object from provider failure', async () => {
    const provider = createProvider();
    send.mockRejectedValueOnce({ name: 'NotFound', $metadata: { httpStatusCode: 404 } });
    await expect(provider.exists('missing')).resolves.toBe(false);
    send.mockRejectedValueOnce(new Error('S3 unavailable'));
    await expect(provider.exists('unknown')).rejects.toThrow('S3 unavailable');
    send.mockResolvedValueOnce({});
    await expect(provider.exists('present')).resolves.toBe(true);
  });

  it('uses a configured CDN URL or a bounded signed URL', async () => {
    const cdn = createProvider('https://cdn.example.test/');
    await expect(cdn.signedDownloadUrl('objects/a b', 'image/png', 300)).resolves.toBe(
      'https://cdn.example.test/objects/a%20b',
    );

    jest.mocked(getSignedUrl).mockResolvedValue('https://signed.example.test');
    const signed = createProvider();
    await expect(signed.signedDownloadUrl('objects/file', 'image/png', 300)).resolves.toBe(
      'https://signed.example.test',
    );
  });

  it('fails when an object response has no body', async () => {
    send.mockResolvedValueOnce({});
    await expect(createProvider().read('objects/file')).rejects.toThrow('body is unavailable');
  });
});

function createProvider(cdnUrl = ''): S3StorageProvider {
  const files = {
    uploadExpirationMs: 86_400_000,
    s3: {
      bucket: 'private-files',
      region: 'us-east-1',
      endpoint: '',
      forcePathStyle: false,
      cdnUrl,
      accessKeyId: '',
      secretAccessKey: '',
      serverSideEncryption: 'AES256',
      kmsKeyId: '',
    },
  } as FilesConfig;
  const config = { getOrThrow: jest.fn(() => files) } as unknown as ConfigService<
    AppConfiguration,
    true
  >;
  return new S3StorageProvider(config);
}
