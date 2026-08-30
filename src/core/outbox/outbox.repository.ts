import { randomUUID } from 'node:crypto';

import { Injectable } from '@nestjs/common';
import { DataSource, type EntityManager } from 'typeorm';

import { OutboxMessageEntity } from './outbox.entity';
import type { OutboxPayload, OutboxTopic } from './outbox.types';

@Injectable()
export class OutboxRepository {
  public constructor(private readonly dataSource: DataSource) {}

  public async cleanupProcessed(
    processedBefore: Date,
    failedBefore: Date,
    limit: number,
  ): Promise<number> {
    return this.dataSource.transaction(async (manager) => {
      const result: unknown = await manager.query(
        `DELETE FROM outbox_messages WHERE id IN (
           SELECT id FROM outbox_messages
           WHERE (status = 'published' AND updated_at < $1)
              OR (status = 'failed' AND updated_at < $2)
           ORDER BY updated_at, id LIMIT $3
         )`,
        [processedBefore, failedBefore, limit],
      );
      return rowCount(result);
    });
  }

  public async insert(
    manager: EntityManager,
    topic: OutboxTopic,
    payload: OutboxPayload,
    correlationId: string,
    version = 1,
  ): Promise<OutboxMessageEntity> {
    const record = manager.getRepository(OutboxMessageEntity).create({
      topic,
      version,
      payload,
      correlationId,
      status: 'pending',
      attempts: 0,
      availableAt: new Date(),
      leaseUntil: null,
      leaseToken: null,
      lastErrorCode: null,
    });
    return manager.getRepository(OutboxMessageEntity).save(record);
  }

  public async claimBatch(limit: number, leaseMs: number): Promise<OutboxMessageEntity[]> {
    return this.dataSource.transaction(async (manager) => {
      const leaseToken = randomUUID();
      const rawResult: unknown = await manager.query(
        `UPDATE outbox_messages SET status = 'processing', attempts = attempts + 1,
          lease_until = now() + ($2 * interval '1 millisecond'), lease_token = $3, updated_at = now()
         WHERE id IN (SELECT id FROM outbox_messages
           WHERE (status = 'pending' OR (status = 'processing' AND lease_until < now()))
             AND available_at <= now() ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT $1)
         RETURNING *`,
        [limit, leaseMs, leaseToken],
      );
      const rawRows = returnedRows(rawResult);
      return rawRows.map((row) =>
        manager.getRepository(OutboxMessageEntity).create({
          id: String(row['id']),
          topic: row['topic'] as OutboxMessageEntity['topic'],
          version: Number(row['version']),
          payload: row['payload'] as OutboxMessageEntity['payload'],
          correlationId: String(row['correlation_id']),
          status: row['status'] as OutboxMessageEntity['status'],
          attempts: Number(row['attempts']),
          availableAt: new Date(String(row['available_at'])),
          leaseUntil: dateValue(row['lease_until']),
          leaseToken: stringValue(row['lease_token']),
          lastErrorCode: stringValue(row['last_error_code']),
          createdAt: dateValue(row['created_at']) ?? new Date(),
          updatedAt: dateValue(row['updated_at']) ?? new Date(),
        }),
      );
    });
  }

  public async markPublished(id: string, leaseToken: string): Promise<void> {
    await this.dataSource.query(
      `UPDATE outbox_messages SET status = 'published', lease_until = NULL, lease_token = NULL, updated_at = now()
       WHERE id = $1 AND status = 'processing' AND lease_token = $2`,
      [id, leaseToken],
    );
  }

  public async markFailed(id: string, leaseToken: string, errorCode: string): Promise<void> {
    await this.dataSource.query(
      `UPDATE outbox_messages SET status = 'failed', last_error_code = $3, lease_until = NULL, lease_token = NULL, updated_at = now()
       WHERE id = $1 AND status = 'processing' AND lease_token = $2`,
      [id, leaseToken, errorCode],
    );
  }
}

function returnedRows(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) return [];
  // TypeORM's PostgreSQL transaction query adapter returns UPDATE ... RETURNING
  // as [rows, rowCount], while other adapters return rows directly.
  const rows = Array.isArray(value[0]) ? value[0] : value;
  return rows.filter(
    (row): row is Record<string, unknown> =>
      typeof row === 'object' && row !== null && !Array.isArray(row),
  );
}

function rowCount(value: unknown): number {
  return typeof value === 'object' &&
    value !== null &&
    'rowCount' in value &&
    typeof value.rowCount === 'number'
    ? value.rowCount
    : 0;
}

function stringValue(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function dateValue(value: unknown): Date | null {
  return value instanceof Date ? value : typeof value === 'string' ? new Date(value) : null;
}
