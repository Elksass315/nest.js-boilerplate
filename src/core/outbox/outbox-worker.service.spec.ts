import type { Queue } from 'bullmq';

import { OutboxMessageEntity } from './outbox.entity';
import type { OutboxRepository } from './outbox.repository';
import { OutboxWorkerService } from './outbox-worker.service';

describe(OutboxWorkerService.name, () => {
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
    const service = new OutboxWorkerService(repository, queue, mailQueue);

    service.onModuleInit();
    await Promise.resolve();
    expect(repository.claimBatch).toHaveBeenCalledWith(50, 30_000);
    await service.onApplicationShutdown();
    expect(queue.close).toHaveBeenCalled();
    expect(mailQueue.close).toHaveBeenCalled();
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
    const service = new OutboxWorkerService(repository, queue, mailQueue);

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

    await new OutboxWorkerService(repository, queue, queue).publish(record);
    expect(repository.markPublished).not.toHaveBeenCalled();
  });
});
