import { Readable } from 'node:stream';

import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { DataStore } from '@tus/server';

import type { AppConfiguration } from '@/config/configuration.types';

import type { StorageProvider, StorageWriteInput } from '../files.types';
import { loadTusRuntime } from '../tus-loader.cjs';

@Injectable()
export class S3StorageProvider implements StorageProvider {
  public readonly driver = 's3' as const;
  private readonly storeConfig: ConstructorParameters<
    Awaited<ReturnType<typeof loadTusRuntime>>['S3Store']
  >[0];
  private store: Promise<DataStore> | null = null;
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly encryption: 'AES256' | 'aws:kms';
  private readonly kmsKeyId: string;
  private readonly cdnUrl: string;

  public constructor(config: ConfigService<AppConfiguration, true>) {
    const files = config.getOrThrow('files', { infer: true });
    const s3 = files.s3;
    this.bucket = s3.bucket;
    this.encryption = s3.serverSideEncryption;
    this.kmsKeyId = s3.kmsKeyId;
    this.cdnUrl = s3.cdnUrl.replace(/\/+$/, '');
    const clientConfig = {
      region: s3.region,
      ...(s3.endpoint.length > 0 ? { endpoint: s3.endpoint } : {}),
      forcePathStyle: s3.forcePathStyle,
      ...(s3.accessKeyId.length > 0
        ? { credentials: { accessKeyId: s3.accessKeyId, secretAccessKey: s3.secretAccessKey } }
        : {}),
    };
    this.client = new S3Client(clientConfig);
    this.storeConfig = {
      s3ClientConfig: { ...clientConfig, bucket: this.bucket },
      expirationPeriodInMilliseconds: files.uploadExpirationMs,
      useTags: true,
      partSize: 5 * 1024 * 1024,
      maxConcurrentPartUploads: 10,
    };
  }

  public tusStore(): Promise<DataStore> {
    const storePromise =
      this.store ??
      loadTusRuntime().then(({ S3Store }) => {
        const store = new S3Store(this.storeConfig);
        store.extensions = ['creation', 'termination', 'expiration'];
        return store;
      });
    this.store = storePromise;
    return storePromise;
  }

  public async read(key: string): Promise<Readable> {
    const result = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
    if (!result.Body) throw new Error('Stored object body is unavailable');
    return Readable.fromWeb(result.Body.transformToWebStream());
  }

  public async write(input: StorageWriteInput): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: input.key,
        Body: input.body,
        ContentLength: input.contentLength,
        ContentType: input.mimeType,
        ChecksumSHA256: input.checksumSha256,
        ServerSideEncryption: this.encryption,
        ...(this.encryption === 'aws:kms' ? { SSEKMSKeyId: this.kmsKeyId } : {}),
      }),
    );
  }

  public async delete(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }

  public async exists(key: string): Promise<boolean> {
    try {
      await this.client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: key }));
      return true;
    } catch (error) {
      if (isNotFound(error)) return false;
      throw error;
    }
  }

  public signedDownloadUrl(
    key: string,
    mimeType: string,
    expiresInSeconds: number,
  ): Promise<string> {
    if (this.cdnUrl.length > 0) {
      return Promise.resolve(`${this.cdnUrl}/${key.split('/').map(encodeURIComponent).join('/')}`);
    }
    return getSignedUrl(
      this.client,
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
        ResponseContentType: mimeType,
        ResponseContentDisposition: 'inline',
      }),
      { expiresIn: expiresInSeconds },
    );
  }

  public async checkHealth(): Promise<void> {
    await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
  }
}

function isNotFound(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const candidate = error as { name?: unknown; $metadata?: { httpStatusCode?: unknown } };
  return candidate.name === 'NotFound' || candidate.$metadata?.httpStatusCode === 404;
}
