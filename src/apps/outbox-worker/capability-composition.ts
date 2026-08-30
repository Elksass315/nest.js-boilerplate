import { BullModule, getQueueToken } from '@nestjs/bullmq';
import type { DynamicModule, Provider } from '@nestjs/common';
import type { Queue } from 'bullmq';

import {
  OUTBOX_CAPABILITY_PUBLISHER,
  type OutboxCapabilityPublisher,
} from '@/core/outbox/outbox-capability-publisher';
import type { OutboxMessageEntity } from '@/core/outbox/outbox.entity';
import { OUTBOX_FILE_QUEUE } from '@/core/outbox/outbox.types';

export const CAPABILITY_OUTBOX_IMPORTS: DynamicModule[] = [
  BullModule.registerQueue({ name: OUTBOX_FILE_QUEUE }),
];

export const CAPABILITY_OUTBOX_PROVIDERS: Provider[] = [
  {
    provide: OUTBOX_CAPABILITY_PUBLISHER,
    inject: [getQueueToken(OUTBOX_FILE_QUEUE)],
    useFactory: (queue: Queue): OutboxCapabilityPublisher => ({
      supports: (topic) => topic === 'file.delete' || topic === 'file.migration-source-delete',
      publish: (record: OutboxMessageEntity) =>
        queue
          .add(
            record.topic === 'file.delete'
              ? 'files.physical-delete'
              : 'files.migration-source-delete',
            record.payload,
            {
              jobId: record.id,
              removeOnComplete: { age: 86_400 },
              removeOnFail: { age: 604_800 },
            },
          )
          .then(() => undefined),
      close: () => queue.close(),
    }),
  },
];
