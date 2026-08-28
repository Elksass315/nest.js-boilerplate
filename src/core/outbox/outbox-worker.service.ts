import { InjectQueue } from '@nestjs/bullmq';
import { Optional } from '@nestjs/common';
import { Injectable, Logger, type OnApplicationShutdown, type OnModuleInit } from '@nestjs/common';
import { Queue } from 'bullmq';

import { OutboxMessageEntity } from './outbox.entity';
import { OutboxRepository } from './outbox.repository';
import { OUTBOX_FILE_QUEUE, OUTBOX_MAIL_QUEUE, OUTBOX_QUEUE } from './outbox.types';
import { WorkerHeartbeatService } from '../worker/worker-heartbeat.service';
import { OperationalMetricsService } from '@/observability/operational-metrics';
import { withTelemetrySpan } from '@/observability/telemetry';

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
    private readonly heartbeat: WorkerHeartbeatService,
    @Optional() private readonly metrics?: OperationalMetricsService,
  ) {}

  public onModuleInit(): void {
    this.heartbeat.start('outbox-worker');
    void this.relay();
    this.timer = setInterval(() => void this.relay(), 1000);
  }

  public async onApplicationShutdown(): Promise<void> {
    this.stopping = true;
    if (this.timer) clearInterval(this.timer);
    await this.queue.close();
    await this.mailQueue.close();
    await this.fileQueue.close();
    await this.heartbeat.stop('outbox-worker');
  }

  private async relay(): Promise<void> {
    if (this.stopping) return;
    const records = await this.repository.claimBatch(50, 30_000);
    await Promise.all(records.map((record) => this.publish(record)));
  }

  public async publish(record: OutboxMessageEntity): Promise<void> {
    try {
      await withTelemetrySpan('outbox.publish', { 'outbox.topic': record.topic }, async () => {
        this.metrics?.recordOutboxAge(
          record.createdAt instanceof Date
            ? Math.max(0, Date.now() - record.createdAt.getTime())
            : 0,
        );
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
        this.metrics?.recordOutbox('published');
      });
    } catch (error: unknown) {
      this.metrics?.recordOutbox('failed');
      this.logger.warn(
        { errorType: error instanceof Error ? error.name : 'UnknownError', messageId: record.id },
        'Outbox publication deferred',
      );
    }
  }
}
