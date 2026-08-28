import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger, type OnApplicationShutdown, type OnModuleInit } from '@nestjs/common';
import { Queue } from 'bullmq';

import { OutboxMessageEntity } from './outbox.entity';
import { OutboxRepository } from './outbox.repository';
import { OUTBOX_FILE_QUEUE, OUTBOX_MAIL_QUEUE, OUTBOX_QUEUE } from './outbox.types';

@Injectable()
export class OutboxWorkerService implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger(OutboxWorkerService.name);
  private timer: NodeJS.Timeout | undefined;
  private stopping = false;

  public constructor(
    private readonly repository: OutboxRepository,
    @InjectQueue(OUTBOX_QUEUE) private readonly queue: Queue,
    @InjectQueue(OUTBOX_MAIL_QUEUE) private readonly mailQueue: Queue,
    @InjectQueue(OUTBOX_FILE_QUEUE) private readonly fileQueue: Queue,
  ) {}

  public onModuleInit(): void {
    void this.relay();
    this.timer = setInterval(() => void this.relay(), 1000);
  }

  public async onApplicationShutdown(): Promise<void> {
    this.stopping = true;
    if (this.timer) clearInterval(this.timer);
    await this.queue.close();
    await this.mailQueue.close();
    await this.fileQueue.close();
  }

  private async relay(): Promise<void> {
    if (this.stopping) return;
    const records = await this.repository.claimBatch(50, 30_000);
    await Promise.all(records.map((record) => this.publish(record)));
  }

  public async publish(record: OutboxMessageEntity): Promise<void> {
    try {
      let destination = this.queue;
      let name: string = record.topic;
      let data: object = {
        messageId: record.id,
        topic: record.topic,
        version: record.version,
        payload: record.payload,
        correlationId: record.correlationId,
      };
      switch (record.topic) {
        case 'mail.send':
          destination = this.mailQueue;
          name = 'send-mail';
          data = record.payload;
          break;
        case 'file.delete':
          destination = this.fileQueue;
          name = 'files.physical-delete';
          data = record.payload;
          break;
        case 'file.migration-source-delete':
          destination = this.fileQueue;
          name = 'files.migration-source-delete';
          data = record.payload;
          break;
      }
      await destination.add(name, data, {
        jobId: record.id,
        removeOnComplete: { age: 86_400 },
        removeOnFail: { age: 604_800 },
      });
      if (record.leaseToken) await this.repository.markPublished(record.id, record.leaseToken);
    } catch (error: unknown) {
      this.logger.warn(
        { errorType: error instanceof Error ? error.name : 'UnknownError', messageId: record.id },
        'Outbox publication deferred',
      );
    }
  }
}
