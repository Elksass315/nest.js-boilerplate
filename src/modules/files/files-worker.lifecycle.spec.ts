import type { Queue } from 'bullmq';
import type { ConfigService } from '@nestjs/config';
import type { PinoLogger } from 'nestjs-pino';

import type { FileWorkerConfiguration } from '@/config/file-worker.environment';
import type { WorkerHeartbeatService } from '@/core/worker/worker-heartbeat.service';

import type { FilesProcessor } from './files.processor';
import { FilesWorkerLifecycle } from './files-worker.lifecycle';
import type { FileJob } from './files.types';

const close = jest.fn();
const on = jest.fn();

jest.mock('bullmq', () => ({
  Worker: jest.fn(() => ({ close, on })),
  Queue: jest.fn(),
}));

describe(FilesWorkerLifecycle.name, () => {
  const values: Record<string, unknown> = {
    redis: {
      host: 'localhost',
      port: 6379,
      password: '',
      db: 0,
      connectTimeoutMs: 1000,
    },
    'files.workerConcurrency': 3,
  };
  const config = {
    getOrThrow: jest.fn((key: string) => values[key]),
  } as unknown as ConfigService<FileWorkerConfiguration, true>;
  const processor = { process: jest.fn() } as unknown as FilesProcessor;
  const queue = { upsertJobScheduler: jest.fn() } as unknown as Queue<FileJob>;
  const logger = {
    setContext: jest.fn(),
    info: jest.fn(),
    error: jest.fn(),
  } as unknown as PinoLogger;
  const heartbeat = { start: jest.fn(), stop: jest.fn().mockResolvedValue(undefined) };

  beforeEach(() => jest.clearAllMocks());

  it('starts a bounded worker and installs one periodic sweeper', async () => {
    const lifecycle = new FilesWorkerLifecycle(
      config,
      processor,
      queue,
      logger,
      heartbeat as unknown as WorkerHeartbeatService,
    );
    await lifecycle.onModuleInit();
    expect(queue.upsertJobScheduler).toHaveBeenCalledWith(
      'files-expired-sweeper',
      { every: 900_000 },
      expect.objectContaining({ name: 'files.sweep-expired' }),
    );
    expect(on).toHaveBeenCalledWith('error', expect.any(Function));
  });

  it('closes the worker during graceful shutdown', async () => {
    const lifecycle = new FilesWorkerLifecycle(
      config,
      processor,
      queue,
      logger,
      heartbeat as unknown as WorkerHeartbeatService,
    );
    await lifecycle.onModuleInit();
    await lifecycle.onApplicationShutdown();
    expect(close).toHaveBeenCalled();
  });
});
