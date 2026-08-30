import { Injectable } from '@nestjs/common';
import { metrics, type Counter, type Histogram, type UpDownCounter } from '@opentelemetry/api';

@Injectable()
export class OperationalMetricsService {
  private readonly requests: Counter;
  private readonly requestDuration: Histogram;
  private readonly throttles: Counter;
  private readonly queueLag: Histogram;
  private readonly outboxAge: Histogram;
  private readonly databasePool: UpDownCounter;
  private readonly outbox: Counter;
  private readonly mailFailures: Counter;
  private readonly fileCleanup: Counter;
  private readonly workerHeartbeats: UpDownCounter;

  public constructor() {
    const meter = metrics.getMeter('nestjs-saas');
    this.requests = meter.createCounter('http.server.requests');
    this.requestDuration = meter.createHistogram('http.server.duration.ms');
    this.throttles = meter.createCounter('security.throttled.requests');
    this.queueLag = meter.createHistogram('queue.job.lag.ms');
    this.outboxAge = meter.createHistogram('outbox.message.age.ms');
    this.databasePool = meter.createUpDownCounter('database.pool.connections');
    this.outbox = meter.createCounter('outbox.messages');
    this.mailFailures = meter.createCounter('mail.delivery.failures');
    this.fileCleanup = meter.createCounter('files.cleanup.items');
    this.workerHeartbeats = meter.createUpDownCounter('worker.heartbeat');
  }

  public recordRequest(route: string, statusCode: number, durationMs: number): void {
    const attributes = { route: normalizeRoute(route), status_code: String(statusCode) };
    this.requests.add(1, attributes);
    this.requestDuration.record(durationMs, { route: normalizeRoute(route) });
  }

  public recordThrottle(scope: string): void {
    this.throttles.add(1, { scope: safeLabel(scope) });
  }

  public recordQueueLag(queue: string, lagMs: number): void {
    this.queueLag.record(lagMs, { queue: safeLabel(queue) });
  }

  public recordOutbox(status: 'published' | 'failed' | 'retried'): void {
    this.outbox.add(1, { status });
  }

  public recordOutboxAge(ageMs: number): void {
    this.outboxAge.record(ageMs);
  }

  public recordDatabasePool(state: 'acquired' | 'released', count = 1): void {
    this.databasePool.add(state === 'acquired' ? count : -count);
  }

  public recordMailFailure(provider: string): void {
    this.mailFailures.add(1, { provider: safeLabel(provider) });
  }

  public recordFileCleanup(status: string, count: number): void {
    this.fileCleanup.add(count, { status: safeLabel(status) });
  }

  public recordWorkerHeartbeat(worker: string, healthy: boolean): void {
    this.workerHeartbeats.add(healthy ? 1 : -1, { worker: safeLabel(worker) });
  }
}

function normalizeRoute(route: string): string {
  const normalized = (route.split('?')[0] ?? route).replace(/\/[0-9a-f-]{16,}/gi, '/:id');
  return normalized.length <= 120 ? normalized : '/unknown';
}

function safeLabel(value: string): string {
  return /^[a-z0-9._:-]{1,64}$/i.test(value) ? value : 'unknown';
}
