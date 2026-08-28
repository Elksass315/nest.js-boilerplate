import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger, type OnApplicationShutdown, type OnModuleInit } from '@nestjs/common';
import { Queue } from 'bullmq';

import { OutboxMessageEntity } from './outbox.entity';
import { OutboxRepository } from './outbox.repository';
import { OUTBOX_MAIL_QUEUE, OUTBOX_QUEUE } from './outbox.types';

@Injectable()
export class OutboxWorkerService implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger(OutboxWorkerService.name);
  private timer: NodeJS.Timeout | undefined;
  private stopping = false;

  public constructor(
    private readonly repository: OutboxRepository,
    @InjectQueue(OUTBOX_QUEUE) private readonly queue: Queue,
    @InjectQueue(OUTBOX_MAIL_QUEUE) private readonly mailQueue: Queue,
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
  }

  private async relay(): Promise<void> {
    if (this.stopping) return;
    const records = await this.repository.claimBatch(50, 30_000);
    await Promise.all(records.map((record) => this.publish(record)));
  }

  public async publish(record: OutboxMessageEntity): Promise<void> {
    try {
      const destination = record.topic === 'mail.send' ? this.mailQueue : this.queue;
      const name = record.topic === 'mail.send' ? 'send-mail' : record.topic;
      const data =
        record.topic === 'mail.send'
          ? record.payload
          : {
              messageId: record.id,
              topic: record.topic,
              version: record.version,
              payload: record.payload,
              correlationId: record.correlationId,
            };
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
