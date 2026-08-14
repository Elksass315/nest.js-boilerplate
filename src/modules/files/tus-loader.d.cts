import type { FileStore } from '@tus/file-store';
import type { S3Store } from '@tus/s3-store';
import type { Server } from '@tus/server';

export interface TusRuntime {
  Server: typeof Server;
  FileStore: typeof FileStore;
  S3Store: typeof S3Store;
}

export function loadTusRuntime(): Promise<TusRuntime>;
