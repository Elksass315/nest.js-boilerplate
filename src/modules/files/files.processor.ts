import { Injectable } from '@nestjs/common';
import type { Job } from 'bullmq';
import { PinoLogger } from 'nestjs-pino';

import { FilesService } from './files.service';
import {
  FILE_DELETE_JOB,
  FILE_MIGRATION_SOURCE_DELETE_JOB,
  FILE_SWEEP_JOB,
  type FileDeleteJobData,
  type FileJob,
  type FileSweepJobData,
} from './files.types';

@Injectable()
export class FilesProcessor {
  public constructor(
    private readonly files: FilesService,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(FilesProcessor.name);
  }

  public async process(job: Job<FileJob>): Promise<void> {
    if (job.name === FILE_DELETE_JOB) {
      await this.deleteFile(job.data as FileDeleteJobData, job.id ?? null, job.attemptsMade + 1);
      return;
    }
    if (job.name === FILE_SWEEP_JOB) {
      await this.sweep(job.data, job.id ?? null);
      return;
    }
    if (job.name === FILE_MIGRATION_SOURCE_DELETE_JOB) {
      await this.deleteMigrationSource(
        job.data as FileDeleteJobData,
        job.id ?? null,
        job.attemptsMade + 1,
      );
      return;
    }
    throw new Error('Unsupported file worker job');
  }

  private async deleteMigrationSource(
    data: FileDeleteJobData,
    jobId: string | null,
    attempt: number,
  ): Promise<void> {
    const context = { fileId: data.fileId, jobId, attempt, correlationId: data.correlationId };
    this.logger.info(context, 'Migrated source deletion started');
    try {
      await this.files.deleteMigrationSource(data.fileId);
      this.logger.info(context, 'Migrated source deletion completed');
    } catch (error) {
      this.logger.error(
        { ...context, errorType: errorName(error) },
        'Migrated source deletion failed',
      );
      throw new Error('Migrated source deletion failed', { cause: error });
    }
  }

  private async deleteFile(
    data: FileDeleteJobData,
    jobId: string | null,
    attempt: number,
  ): Promise<void> {
    const context = { fileId: data.fileId, jobId, attempt, correlationId: data.correlationId };
    this.logger.info(context, 'File deletion started');
    try {
      await this.files.deletePhysicalFile(data.fileId);
      this.logger.info(context, 'File deletion completed');
    } catch (error) {
      this.logger.error({ ...context, errorType: errorName(error) }, 'File deletion failed');
      throw new Error('File deletion failed', { cause: error });
    }
  }

  private async sweep(data: FileSweepJobData, jobId: string | null): Promise<void> {
    this.logger.info({ jobId, correlationId: data.correlationId }, 'Expired file sweep started');
    const scheduled = await this.files.sweepExpired(data.correlationId);
    this.logger.info(
      { jobId, correlationId: data.correlationId, scheduled },
      'Expired file sweep completed',
    );
  }
}

function errorName(error: unknown): string {
  return error instanceof Error ? error.name : 'UnknownError';
}
