import type { ConfigService } from '@nestjs/config';
import type { Queue, Worker } from 'bullmq';
import type { PinoLogger } from 'nestjs-pino';

import type { MailWorkerConfiguration } from '@/config/configuration.types';
import type { WorkerHeartbeatService } from '@/core/worker/worker-heartbeat.service';
import { MailWorkerLifecycle } from './mail-worker.lifecycle';
import type { MailProcessor } from './mail.processor';
import type { SmtpProvider } from './smtp.provider';

const workerClose = jest.fn().mockResolvedValue(undefined);
const workerOn = jest.fn();

jest.mock('bullmq', () => ({
  Worker: jest.fn(() => ({ close: workerClose, on: workerOn })) as unknown as typeof Worker,
  Queue: jest.fn() as unknown as typeof Queue,
}));

describe(MailWorkerLifecycle.name, () => {
  const values: Record<string, unknown> = {
    'mail.enabled': true,
    'mail.workerConcurrency': 3,
    redis: {
      host: 'localhost',
      port: 6379,
      password: '',
      db: 0,
      connectTimeoutMs: 1000,
    },
  };
  const config = {
    getOrThrow: jest.fn((key: string) => values[key]),
  } as unknown as ConfigService<MailWorkerConfiguration, true>;
  const processor = { process: jest.fn() } as unknown as MailProcessor;
  const smtp = {
    verify: jest.fn().mockResolvedValue(undefined),
    close: jest.fn(),
  } as unknown as SmtpProvider;
  const logger = {
    setContext: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  } as unknown as PinoLogger;
  const heartbeat = {
    start: jest.fn(),
    stop: jest.fn().mockResolvedValue(undefined),
  } as unknown as WorkerHeartbeatService;

  beforeEach(() => {
    jest.clearAllMocks();
    values['mail.enabled'] = true;
  });

  it('verifies SMTP and starts a worker with configured Redis settings', async () => {
    const lifecycle = new MailWorkerLifecycle(config, processor, smtp, logger, heartbeat);

    await lifecycle.onModuleInit();

    expect(heartbeat.start).toHaveBeenCalledWith('mail-worker');
    expect(smtp.verify).toHaveBeenCalled();
    expect(workerOn).toHaveBeenCalledWith('error', expect.any(Function));
    await lifecycle.onApplicationShutdown();
    expect(workerClose).toHaveBeenCalled();
    expect(smtp.close).toHaveBeenCalled();
    expect(heartbeat.stop).toHaveBeenCalledWith('mail-worker');
  });

  it('keeps the process healthy without opening SMTP when mail is disabled', async () => {
    values['mail.enabled'] = false;
    const lifecycle = new MailWorkerLifecycle(config, processor, smtp, logger, heartbeat);

    await lifecycle.onModuleInit();

    expect(heartbeat.start).toHaveBeenCalledWith('mail-worker');
    expect(smtp.verify).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledWith('Mail worker is disabled by configuration');
    await lifecycle.onApplicationShutdown();
    expect(heartbeat.stop).toHaveBeenCalledWith('mail-worker');
  });
});
