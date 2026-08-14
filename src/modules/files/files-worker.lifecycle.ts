import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, type OnApplicationShutdown, type OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue, Worker } from 'bullmq';
import { PinoLogger } from 'nestjs-pino';

import type { FileWorkerConfiguration } from '@/config/configuration.types';
import type { RedisConfig } from '@/redis/config/redis.config';

import { FilesProcessor } from './files.processor';
import { FILE_QUEUE, FILE_SWEEP_JOB, type FileJob } from './files.types';

@Injectable()
export class FilesWorkerLifecycle implements OnModuleInit, OnApplicationShutdown {
  private worker: Worker<FileJob> | null = null;

  public constructor(
    private readonly config: ConfigService<FileWorkerConfiguration, true>,
    private readonly processor: FilesProcessor,
    @InjectQueue(FILE_QUEUE) private readonly queue: Queue<FileJob>,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(FilesWorkerLifecycle.name);
  }

  public async onModuleInit(): Promise<void> {
    const redis = this.config.getOrThrow<RedisConfig>('redis');
    this.worker = new Worker<FileJob>(FILE_QUEUE, (job) => this.processor.process(job), {
      connection: {
        host: redis.host,
        port: redis.port,
        password: redis.password.length > 0 ? redis.password : undefined,
        db: redis.db,
        connectTimeout: redis.connectTimeoutMs,
      },
      concurrency: this.config.getOrThrow('files.workerConcurrency', { infer: true }),
    });
    this.worker.on('error', (error) => {
      this.logger.error({ errorType: error.name }, 'File worker error');
    });
    await this.queue.upsertJobScheduler(
      'files-expired-sweeper',
      { every: 15 * 60 * 1000 },
      {
        name: FILE_SWEEP_JOB,
        data: { correlationId: 'files-periodic-sweeper' },
        opts: { removeOnComplete: { age: 3600 }, removeOnFail: { age: 86_400 } },
      },
    );
    this.logger.info('File worker started');
  }

  public async onApplicationShutdown(): Promise<void> {
    await this.worker?.close();
    this.logger.info('File worker stopped');
  }
}
