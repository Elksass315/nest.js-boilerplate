import { Injectable, type OnApplicationShutdown, type OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Worker } from 'bullmq';
import { PinoLogger } from 'nestjs-pino';

import type { MailWorkerConfiguration } from '@/config/configuration.types';
import type { RedisConfig } from '@/redis/config/redis.config';

import { MailProcessor } from './mail.processor';
import { MAIL_QUEUE, type MailJob } from './mail.types';
import { SmtpProvider } from './smtp.provider';

@Injectable()
export class MailWorkerLifecycle implements OnModuleInit, OnApplicationShutdown {
  private worker: Worker<MailJob> | null = null;

  public constructor(
    private readonly config: ConfigService<MailWorkerConfiguration, true>,
    private readonly processor: MailProcessor,
    private readonly smtp: SmtpProvider,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(MailWorkerLifecycle.name);
  }

  public async onModuleInit(): Promise<void> {
    if (!this.config.getOrThrow('mail.enabled', { infer: true })) {
      this.logger.warn('Mail worker is disabled by configuration');
      return;
    }
    await this.smtp.verify();
    const redis = this.config.getOrThrow<RedisConfig>('redis');
    this.worker = new Worker<MailJob>(MAIL_QUEUE, (job) => this.processor.process(job), {
      connection: {
        host: redis.host,
        port: redis.port,
        password: redis.password.length > 0 ? redis.password : undefined,
        db: redis.db,
        connectTimeout: redis.connectTimeoutMs,
      },
      concurrency: this.config.getOrThrow('mail.workerConcurrency', { infer: true }),
    });
    this.worker.on('error', (error) => {
      this.logger.error({ errorType: error.name }, 'Mail worker error');
    });
    this.logger.info('Mail worker started');
  }

  public async onApplicationShutdown(): Promise<void> {
    await this.worker?.close();
    this.smtp.close();
    this.logger.info('Mail worker stopped');
  }
}
