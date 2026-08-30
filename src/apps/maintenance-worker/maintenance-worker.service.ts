import {
  Inject,
  Injectable,
  Optional,
  type OnApplicationShutdown,
  type OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource } from '@nestjs/typeorm';
import { PinoLogger } from 'nestjs-pino';
import { DataSource } from 'typeorm';

import type { AppConfiguration } from '@/config/configuration.types';
import { OperationalMetricsService } from '@/observability/operational-metrics';
import { AuthService } from '@/modules/auth';
import { MailService } from '@/modules/mail';
import { OutboxRepository } from '@/core/outbox/outbox.repository';
import { WorkerHeartbeatService } from '@/core/worker/worker-heartbeat.service';
import {
  MAINTENANCE_CAPABILITY_CLEANER,
  type MaintenanceCapabilityCleaner,
} from './maintenance-capability-cleaner';

export interface MaintenanceRunResult {
  dryRun: boolean;
  correlationId: string;
  auth: number;
  mail: number;
  outbox: number;
  capabilities: Record<string, number>;
  total: number;
}

@Injectable()
export class MaintenanceWorkerService implements OnModuleInit, OnApplicationShutdown {
  private timer: NodeJS.Timeout | undefined;
  private stopping = false;

  public constructor(
    private readonly config: ConfigService<AppConfiguration, true>,
    private readonly auth: AuthService,
    private readonly mail: MailService,
    private readonly outbox: OutboxRepository,
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly heartbeat: WorkerHeartbeatService,
    private readonly metrics: OperationalMetricsService,
    private readonly logger: PinoLogger,
    @Optional()
    @Inject(MAINTENANCE_CAPABILITY_CLEANER)
    private readonly capabilityCleaner?: MaintenanceCapabilityCleaner,
  ) {
    this.logger.setContext(MaintenanceWorkerService.name);
  }

  public onModuleInit(): void {
    this.heartbeat.start('maintenance-worker');
    const retention = this.config.getOrThrow('retention', { infer: true });
    if (!retention.enabled) {
      this.logger.warn('Maintenance worker is disabled by configuration');
      return;
    }
    void this.runOnce();
    this.timer = setInterval(() => void this.runOnce(), retention.intervalMs);
    this.timer.unref();
  }

  public async onApplicationShutdown(): Promise<void> {
    this.stopping = true;
    if (this.timer) clearInterval(this.timer);
    await this.heartbeat.stop('maintenance-worker');
  }

  public async runOnce(
    options: { dryRun?: boolean; correlationId?: string } = {},
  ): Promise<MaintenanceRunResult> {
    const correlationId = options.correlationId ?? `maintenance-${String(Date.now())}`;
    const dryRun = options.dryRun ?? false;
    const retention = this.config.getOrThrow('retention', { infer: true });
    const result: MaintenanceRunResult = {
      dryRun,
      correlationId,
      auth: 0,
      mail: 0,
      outbox: 0,
      capabilities: {},
      total: 0,
    };
    if (dryRun) {
      this.logger.info({ correlationId, dryRun: true }, 'Retention dry run completed');
      return result;
    }
    if (this.stopping) return result;
    await this.dataSource.transaction(async (manager) => {
      const lock: unknown = await manager.query(
        "SELECT pg_try_advisory_xact_lock(hashtext('maintenance:retention')) AS locked",
      );
      if (!isLockAcquired(lock)) return;
      const now = Date.now();
      const cutoff = (days: number): Date => new Date(now - days * 86_400_000);
      const batch = retention.batchSize;
      result.auth = await this.auth.cleanupOperationalData(
        cutoff(retention.authTokenDays),
        cutoff(retention.sessionDays),
        batch,
      );
      result.mail = await this.mail.cleanupDeliveries(cutoff(retention.mailDays), batch);
      result.outbox = await this.outbox.cleanupProcessed(
        cutoff(retention.outboxDays),
        cutoff(retention.outboxFailureDays),
        batch,
      );
      if (this.capabilityCleaner) {
        result.capabilities[this.capabilityCleaner.name] = await this.capabilityCleaner.cleanup(
          new Date(now),
          batch,
        );
      }
    });
    result.total =
      result.auth +
      result.mail +
      result.outbox +
      Object.values(result.capabilities).reduce((total, count) => total + count, 0);
    this.metrics.recordFileCleanup('retention', result.total);
    this.logger.info({ correlationId, deleted: result.total }, 'Retention cleanup completed');
    return result;
  }
}

function isLockAcquired(value: unknown): boolean {
  if (!Array.isArray(value)) return false;
  const first: unknown = value[0];
  return typeof first === 'object' && first !== null && 'locked' in first && first.locked === true;
}
