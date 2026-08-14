import type { Readable } from 'node:stream';

import type { DataStore } from '@tus/server';

import type { FileStorageDriver } from '@/config/configuration.types';

export type FileVisibility = 'protected' | 'public';

export type FileStatus = 'uploading' | 'uploaded' | 'ready' | 'deleting' | 'failed';

export const FILE_QUEUE = 'files';
export const FILE_DELETE_JOB = 'files.physical-delete';
export const FILE_SWEEP_JOB = 'files.sweep-expired';
export const FILE_MIGRATION_SOURCE_DELETE_JOB = 'files.migration-source-delete';

export interface FilePurposePolicy {
  purpose: string;
  maxBytes: number;
  allowedDeclaredMimeTypes: readonly string[];
}

export interface TusRequestContext {
  uploaderId: string | null;
  requestId: string;
  correlationId: string;
  routePath: string;
  policy: FilePurposePolicy;
}

export interface StoredFile {
  id: string;
  publicId: string;
  provider: FileStorageDriver;
  storageKey: string;
  originalName: string;
  mimeType: string;
  sizeBytes: string;
  checksumSha256: string | null;
  visibility: FileVisibility;
  status: FileStatus;
  purpose: string;
  uploadedBy: string;
  expiresAt: Date;
  completedAt: Date | null;
  claimedAt: Date | null;
  deleteRequestedAt: Date | null;
  failureCode: string | null;
  pendingDeleteProvider: FileStorageDriver | null;
  pendingDeleteStorageKey: string | null;
  requestId: string;
  correlationId: string;
}

export interface StorageWriteInput {
  key: string;
  body: Readable | Uint8Array;
  contentLength: number;
  mimeType: string;
  checksumSha256?: string;
}

export interface StorageProvider {
  readonly driver: FileStorageDriver;
  tusStore(): Promise<DataStore>;
  read(key: string): Promise<Readable>;
  write(input: StorageWriteInput): Promise<void>;
  delete(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
  signedDownloadUrl(
    key: string,
    mimeType: string,
    expiresInSeconds: number,
  ): Promise<string | null>;
  checkHealth(): Promise<void>;
}

export interface FileDeleteJobData {
  fileId: string;
  correlationId: string;
}

export interface FileSweepJobData {
  correlationId: string;
}

export type FileJob = FileDeleteJobData | FileSweepJobData;

export interface FileMigrationOptions {
  from: FileStorageDriver;
  to: FileStorageDriver;
  dryRun: boolean;
  confirmed: boolean;
  batchSize: number;
}

export interface FileMigrationResult {
  examined: number;
  migrated: number;
  dryRun: boolean;
}

export type PublicFileAccess =
  | { kind: 'redirect'; url: string }
  | {
      kind: 'stream';
      stream: Readable;
      mimeType: string;
      sizeBytes: string;
      checksumSha256: string | null;
    };
