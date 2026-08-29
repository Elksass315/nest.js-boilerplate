import type { Queue } from 'bullmq';

import { OutboxMessageEntity } from './outbox.entity';
import type { OutboxRepository } from './outbox.repository';
import { OutboxWorkerService } from './outbox-worker.service';
import type { WorkerHeartbeatService } from '../worker/worker-heartbeat.service';
import type { OutboxCapabilityPublisher } from './outbox-capability-publisher';

describe(OutboxWorkerService.name, () => {
  const heartbeat = { start: jest.fn(), stop: jest.fn().mockResolvedValue(undefined) };
  const publisher = (queue: Queue): OutboxCapabilityPublisher => ({
    supports: (topic) => topic === 'file.delete' || topic === 'file.migration-source-delete',
    publish: (record) =>
      queue
        .add(
          record.topic === 'file.delete'
            ? 'files.physical-delete'
            : 'files.migration-source-delete',
          record.payload,
          { jobId: record.id },
        )
        .then(() => undefined),
    close: () => queue.close(),
  });

  it('starts a polling relay and closes cleanly on shutdown', async () => {
    jest.useFakeTimers();
    const repository = {
      claimBatch: jest.fn().mockResolvedValue([]),
    } as unknown as OutboxRepository;
    const queue = {
      add: jest.fn(),
      close: jest.fn().mockResolvedValue(undefined),
    } as unknown as Queue;
    const mailQueue = {
      add: jest.fn(),
      close: jest.fn().mockResolvedValue(undefined),
    } as unknown as Queue;
    const fileQueue = { close: jest.fn().mockResolvedValue(undefined) } as unknown as Queue;
    const service = new OutboxWorkerService(
      repository,
      queue,
      mailQueue,
      heartbeat as unknown as WorkerHeartbeatService,
      undefined,
      publisher(fileQueue),
    );

    service.onModuleInit();
    await Promise.resolve();
    expect(repository.claimBatch).toHaveBeenCalledWith(50, 30_000);
    await service.onApplicationShutdown();
    expect(queue.close).toHaveBeenCalled();
    expect(mailQueue.close).toHaveBeenCalled();
    expect(fileQueue.close).toHaveBeenCalled();
    jest.useRealTimers();
  });

  it('publishes with the outbox UUID as the idempotent BullMQ job ID', async () => {
    const record = Object.assign(new OutboxMessageEntity(), {
      id: '11111111-1111-4111-8111-111111111111',
      topic: 'mail.send' as const,
      version: 1,
      payload: { template: 'welcome' },
      correlationId: 'correlation-1',
      leaseToken: '22222222-2222-4222-8222-222222222222',
    });
    const repository = {
      claimBatch: jest.fn().mockResolvedValue([]),
      markPublished: jest.fn().mockResolvedValue(undefined),
    } as unknown as OutboxRepository;
    const queue = {
      add: jest.fn().mockResolvedValue(undefined),
      close: jest.fn(),
    } as unknown as Queue;
    const mailQueue = { add: jest.fn().mockResolvedValue(undefined) } as unknown as Queue;
    const service = new OutboxWorkerService(
      repository,
      queue,
      mailQueue,
      heartbeat as unknown as WorkerHeartbeatService,
    );

    await service.publish(record);

    expect(mailQueue.add).toHaveBeenCalledWith(
      'send-mail',
      record.payload,
      expect.objectContaining({ jobId: record.id }),
    );
    expect(repository.markPublished).toHaveBeenCalledWith(record.id, record.leaseToken);
  });

  it('leaves the lease to expire when Redis/BullMQ publication fails', async () => {
    const record = Object.assign(new OutboxMessageEntity(), {
      id: '11111111-1111-4111-8111-111111111111',
      topic: 'file.delete' as const,
      payload: {},
      correlationId: 'correlation-1',
      leaseToken: '22222222-2222-4222-8222-222222222222',
    });
    const repository = { markPublished: jest.fn() } as unknown as OutboxRepository;
    const queue = {
      add: jest.fn().mockRejectedValue(new Error('queue unavailable')),
    } as unknown as Queue;

    const mailQueue = { add: jest.fn() } as unknown as Queue;
    const fileQueue = {
      add: jest.fn().mockRejectedValue(new Error('queue unavailable')),
    } as unknown as Queue;
    await new OutboxWorkerService(
      repository,
      queue,
      mailQueue,
      heartbeat as unknown as WorkerHeartbeatService,
      { recordOutboxAge: jest.fn(), recordOutbox: jest.fn() } as never,
      publisher(fileQueue),
    ).publish(record);
    expect(repository.markPublished).not.toHaveBeenCalled();
  });

  it('routes file cleanup payloads to the file queue with the stable job name', async () => {
    const record = Object.assign(new OutboxMessageEntity(), {
      id: '33333333-3333-4333-8333-333333333333',
      topic: 'file.delete' as const,
      version: 1,
      payload: { fileId: 'file-1', correlationId: 'corr-1' },
      correlationId: 'corr-1',
      leaseToken: '44444444-4444-4444-8444-444444444444',
    });
    const repository = {
      markPublished: jest.fn().mockResolvedValue(undefined),
    } as unknown as OutboxRepository;
    const queue = { add: jest.fn() } as unknown as Queue;
    const mailQueue = { add: jest.fn() } as unknown as Queue;
    const fileQueue = { add: jest.fn().mockResolvedValue(undefined) } as unknown as Queue;

    await new OutboxWorkerService(
      repository,
      queue,
      mailQueue,
      heartbeat as unknown as WorkerHeartbeatService,
      undefined,
      publisher(fileQueue),
    ).publish(record);

    expect(fileQueue.add).toHaveBeenCalledWith(
      'files.physical-delete',
      record.payload,
      expect.objectContaining({ jobId: record.id }),
    );
    expect(repository.markPublished).toHaveBeenCalledWith(record.id, record.leaseToken);
  });

  it('publishes non-feature topics to the shared outbox queue', async () => {
    const record = Object.assign(new OutboxMessageEntity(), {
      id: '11111111-1111-4111-8111-111111111111',
      topic: 'mail.send' as const,
      version: 1,
      payload: { template: 'welcome' },
      correlationId: 'correlation-1',
      leaseToken: null,
      createdAt: new Date(),
    });
    record.topic = 'unknown.topic' as OutboxMessageEntity['topic'];
    const repository = { markPublished: jest.fn() } as unknown as OutboxRepository;
    const queue = { add: jest.fn().mockResolvedValue(undefined) } as unknown as Queue;
    const service = new OutboxWorkerService(
      repository,
      queue,
      { add: jest.fn() } as unknown as Queue,
      heartbeat as unknown as WorkerHeartbeatService,
      { recordOutboxAge: jest.fn(), recordOutbox: jest.fn() } as never,
    );

    await service.publish(record);
    expect(queue.add).toHaveBeenCalledWith('unknown.topic', expect.any(Object), expect.any(Object));
  });

  it('routes migration-source cleanup to the file queue', async () => {
    const record = Object.assign(new OutboxMessageEntity(), {
      id: '11111111-1111-4111-8111-111111111111',
      topic: 'file.migration-source-delete' as const,
      version: 1,
      payload: { fileId: 'file-1', correlationId: 'correlation-1' },
      correlationId: 'correlation-1',
      leaseToken: null,
    });
    const repository = { markPublished: jest.fn() } as unknown as OutboxRepository;
    const fileQueue = { add: jest.fn().mockResolvedValue(undefined) } as unknown as Queue;
    const service = new OutboxWorkerService(
      repository,
      { add: jest.fn() } as unknown as Queue,
      { add: jest.fn() } as unknown as Queue,
      heartbeat as unknown as WorkerHeartbeatService,
      undefined,
      publisher(fileQueue),
    );

    await service.publish(record);
    expect(fileQueue.add).toHaveBeenCalledWith(
      'files.migration-source-delete',
      record.payload,
      expect.any(Object),
    );
  });
});
