import type { ConfigService } from '@nestjs/config';
import type { PinoLogger } from 'nestjs-pino';
import type { DataSource, EntityManager } from 'typeorm';

import type { AppConfiguration } from '@/config/configuration.types';
import type { OutboxRepository } from '@/core/outbox/outbox.repository';
import type { WorkerHeartbeatService } from '@/core/worker/worker-heartbeat.service';
import type { AuthService } from '@/modules/auth';
import type { MailService } from '@/modules/mail';
import type { OperationalMetricsService } from '@/observability/operational-metrics';

import { MaintenanceWorkerService } from './maintenance-worker.service';
import type { MaintenanceCapabilityCleaner } from './maintenance-capability-cleaner';

describe(MaintenanceWorkerService.name, () => {
  const retention = {
    enabled: true,
    intervalMs: 900_000,
    batchSize: 100,
    authTokenDays: 30,
    sessionDays: 60,
    mailDays: 90,
    outboxDays: 30,
    outboxFailureDays: 365,
  };
  const config = {
    getOrThrow: jest.fn(() => retention),
  } as unknown as ConfigService<AppConfiguration, true>;
  const auth = { cleanupOperationalData: jest.fn().mockResolvedValue(1) };
  const mail = { cleanupDeliveries: jest.fn().mockResolvedValue(2) };
  const outbox = { cleanupProcessed: jest.fn().mockResolvedValue(3) };
  const files = { cleanupTemporaryMetadata: jest.fn().mockResolvedValue(4) };
  const heartbeat = { start: jest.fn(), stop: jest.fn().mockResolvedValue(undefined) };
  const metrics = { recordFileCleanup: jest.fn() };
  const logger = {
    setContext: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
  };
  const manager = { query: jest.fn().mockResolvedValue([{ locked: true }]) };
  const dataSource = {
    transaction: jest.fn(async (work: (manager: EntityManager) => Promise<void>) =>
      work(manager as unknown as EntityManager),
    ),
  };
  let service: MaintenanceWorkerService;

  beforeEach(() => {
    jest.clearAllMocks();
    retention.enabled = true;
    manager.query.mockResolvedValue([{ locked: true }]);
    auth.cleanupOperationalData.mockResolvedValue(1);
    mail.cleanupDeliveries.mockResolvedValue(2);
    outbox.cleanupProcessed.mockResolvedValue(3);
    files.cleanupTemporaryMetadata.mockResolvedValue(4);
    service = new MaintenanceWorkerService(
      config,
      auth as unknown as AuthService,
      mail as unknown as MailService,
      outbox as unknown as OutboxRepository,
      dataSource as unknown as DataSource,
      heartbeat as unknown as WorkerHeartbeatService,
      metrics as unknown as OperationalMetricsService,
      logger as unknown as PinoLogger,
      {
        name: 'files',
        cleanup: (_now: Date, _limit: number): Promise<number> => {
          void _now;
          void _limit;
          return Promise.resolve(4);
        },
      } satisfies MaintenanceCapabilityCleaner,
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('applies independent retention cutoffs under the advisory lock', async () => {
    jest.spyOn(Date, 'now').mockReturnValue(new Date('2026-08-29T00:00:00.000Z').getTime());

    await expect(service.runOnce({ correlationId: 'correlation-1' })).resolves.toEqual({
      dryRun: false,
      correlationId: 'correlation-1',
      auth: 1,
      mail: 2,
      outbox: 3,
      capabilities: { files: 4 },
      total: 10,
    });

    expect(auth.cleanupOperationalData).toHaveBeenCalledWith(
      new Date('2026-07-30T00:00:00.000Z'),
      new Date('2026-06-30T00:00:00.000Z'),
      100,
    );
    expect(metrics.recordFileCleanup).toHaveBeenCalledWith('retention', 10);
  });

  it('does not delete when another worker owns the advisory lock', async () => {
    manager.query.mockResolvedValue([{ locked: false }]);

    await expect(service.runOnce()).resolves.toEqual(expect.objectContaining({ total: 0 }));

    expect(auth.cleanupOperationalData).not.toHaveBeenCalled();
    expect(mail.cleanupDeliveries).not.toHaveBeenCalled();
  });

  it('keeps dry runs non-mutating', async () => {
    await expect(service.runOnce({ dryRun: true, correlationId: 'dry-run-1' })).resolves.toEqual(
      expect.objectContaining({ dryRun: true, correlationId: 'dry-run-1', total: 0 }),
    );

    expect(dataSource.transaction).not.toHaveBeenCalled();
    expect(logger.info).toHaveBeenCalledWith(
      { correlationId: 'dry-run-1', dryRun: true },
      'Retention dry run completed',
    );
  });

  it('does not schedule cleanup when retention is disabled', () => {
    retention.enabled = false;

    service.onModuleInit();

    expect(heartbeat.start).toHaveBeenCalledWith('maintenance-worker');
    expect(logger.warn).toHaveBeenCalledWith('Maintenance worker is disabled by configuration');
    expect(dataSource.transaction).not.toHaveBeenCalled();
  });

  it('stops heartbeat activity during shutdown', async () => {
    await service.onApplicationShutdown();

    expect(heartbeat.stop).toHaveBeenCalledWith('maintenance-worker');
    await expect(service.runOnce()).resolves.toEqual(expect.objectContaining({ total: 0 }));
    expect(dataSource.transaction).not.toHaveBeenCalled();
  });
});
