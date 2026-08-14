import { createReadStream, createWriteStream, constants as fsConstants } from 'node:fs';
import { access, mkdir, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { DataStore } from '@tus/server';

import type { AppConfiguration } from '@/config/configuration.types';

import type { StorageProvider, StorageWriteInput } from '../files.types';
import { loadTusRuntime } from '../tus-loader.cjs';

@Injectable()
export class LocalStorageProvider implements StorageProvider {
  public readonly driver = 'local' as const;
  private readonly uploadExpirationMs: number;
  private store: Promise<DataStore> | null = null;
  private readonly root: string;

  public constructor(config: ConfigService<AppConfiguration, true>) {
    const files = config.getOrThrow('files', { infer: true });
    this.root = files.localRoot;
    this.uploadExpirationMs = files.uploadExpirationMs;
  }

  public tusStore(): Promise<DataStore> {
    const storePromise =
      this.store ??
      loadTusRuntime().then(({ FileStore }) => {
        const store = new FileStore({
          directory: this.root,
          expirationPeriodInMilliseconds: this.uploadExpirationMs,
        });
        store.extensions = ['creation', 'termination', 'expiration'];
        return store;
      });
    this.store = storePromise;
    return storePromise;
  }

  public async read(key: string): Promise<Readable> {
    const fullPath = this.resolveSafePath(key);
    await access(fullPath, fsConstants.R_OK);
    return createReadStream(fullPath);
  }

  public async write(input: StorageWriteInput): Promise<void> {
    const target = this.resolveSafePath(input.key);
    const temporary = `${target}.tmp`;
    await mkdir(path.dirname(target), { recursive: true });
    try {
      if (input.body instanceof Uint8Array) {
        await writeFile(temporary, input.body, { flag: 'wx' });
      } else {
        await pipeline(input.body, createWriteStream(temporary, { flags: 'wx' }));
      }
      await rename(temporary, target);
    } catch (error) {
      await rm(temporary, { force: true });
      throw error;
    }
  }

  public delete(key: string): Promise<void> {
    return rm(this.resolveSafePath(key), { force: true });
  }

  public async exists(key: string): Promise<boolean> {
    try {
      await access(this.resolveSafePath(key), fsConstants.F_OK);
      return true;
    } catch {
      return false;
    }
  }

  public signedDownloadUrl(): Promise<null> {
    return Promise.resolve(null);
  }

  public async checkHealth(): Promise<void> {
    await mkdir(this.root, { recursive: true });
    await access(this.root, fsConstants.R_OK | fsConstants.W_OK);
  }

  private resolveSafePath(key: string): string {
    const normalized = key.replaceAll('\\', '/');
    if (
      normalized.startsWith('/') ||
      normalized.split('/').some((segment) => segment.length === 0 || segment === '..')
    ) {
      throw new Error('Unsafe storage key');
    }
    const resolved = path.resolve(this.root, normalized);
    const relative = path.relative(this.root, resolved);
    if (relative.startsWith('..') || path.isAbsolute(relative))
      throw new Error('Unsafe storage key');
    return resolved;
  }
}
