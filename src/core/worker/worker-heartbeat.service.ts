import { mkdirSync, unlinkSync, writeFileSync } from 'node:fs';

import { Injectable, Logger, Optional } from '@nestjs/common';

import { OperationalMetricsService } from '@/observability/operational-metrics';

const HEARTBEAT_INTERVAL_MS = 10_000;

@Injectable()
export class WorkerHeartbeatService {
  private readonly logger = new Logger(WorkerHeartbeatService.name);
  private readonly timers = new Map<string, NodeJS.Timeout>();
  private readonly paths = new Map<string, string>();

  public constructor(@Optional() private readonly metrics?: OperationalMetricsService) {}

  public start(workerName: string): void {
    if (this.timers.has(workerName)) return;
    const path = `/tmp/nestjs-saas-${workerName}.heartbeat`;
    this.paths.set(workerName, path);
    const beat = (): void => {
      try {
        mkdirSync('/tmp', { recursive: true });
        writeFileSync(path, `${String(Date.now())}\n`, { encoding: 'utf8' });
      } catch (error: unknown) {
        this.logger.warn(
          { workerName, errorType: error instanceof Error ? error.name : 'UnknownError' },
          'Worker heartbeat write failed',
        );
      }
    };
    beat();
    this.metrics?.recordWorkerHeartbeat(workerName, true);
    const timer = setInterval(beat, HEARTBEAT_INTERVAL_MS);
    timer.unref();
    this.timers.set(workerName, timer);
  }

  public stop(workerName: string): Promise<void> {
    const timer = this.timers.get(workerName);
    if (timer) clearInterval(timer);
    this.timers.delete(workerName);
    this.metrics?.recordWorkerHeartbeat(workerName, false);
    const path = this.paths.get(workerName);
    this.paths.delete(workerName);
    if (!path) return Promise.resolve();
    try {
      unlinkSync(path);
    } catch (error: unknown) {
      if (isNodeError(error) && error.code === 'ENOENT') return Promise.resolve();
      this.logger.warn(
        { workerName, errorType: error instanceof Error ? error.name : 'UnknownError' },
        'Worker heartbeat cleanup failed',
      );
    }
    return Promise.resolve();
  }
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error;
}
