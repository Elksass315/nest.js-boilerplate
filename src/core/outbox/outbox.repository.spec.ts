import type { DataSource, EntityManager, Repository } from 'typeorm';

import { OutboxMessageEntity } from './outbox.entity';
import { OutboxRepository } from './outbox.repository';

describe(OutboxRepository.name, () => {
  it('inserts using the caller transaction manager', async () => {
    const saved = new OutboxMessageEntity();
    const repository = {
      create: jest.fn((value: OutboxMessageEntity) => value),
      save: jest.fn().mockResolvedValue(saved),
    } as unknown as Repository<OutboxMessageEntity>;
    const manager = {
      getRepository: jest.fn().mockReturnValue(repository),
    } as unknown as EntityManager;

    await expect(
      new OutboxRepository({} as DataSource).insert(
        manager,
        'mail.send',
        { template: 'welcome' },
        'correlation-1',
      ),
    ).resolves.toBe(saved);
    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        topic: 'mail.send',
        status: 'pending',
        correlationId: 'correlation-1',
      }),
    );
  });

  it('claims expired leases with a bounded SKIP LOCKED transaction', async () => {
    const entityRepository = { create: jest.fn((value: OutboxMessageEntity) => value) };
    const manager = {
      query: jest.fn().mockResolvedValue([
        {
          id: '11111111-1111-4111-8111-111111111111',
          topic: 'file.delete',
          version: 1,
          payload: { key: 'safe-key' },
          correlation_id: 'correlation-1',
          status: 'processing',
          attempts: 1,
          available_at: new Date().toISOString(),
          lease_until: new Date().toISOString(),
          lease_token: '22222222-2222-4222-8222-222222222222',
          last_error_code: null,
        },
      ]),
      getRepository: jest.fn().mockReturnValue(entityRepository),
    } as unknown as EntityManager;
    const dataSource = {
      transaction: jest.fn(
        async (callback: (value: EntityManager) => Promise<OutboxMessageEntity[]>) =>
          callback(manager),
      ),
    } as unknown as DataSource;

    const records = await new OutboxRepository(dataSource).claimBatch(10, 30_000);
    expect(records).toHaveLength(1);
    expect(manager.query).toHaveBeenCalledWith(expect.stringContaining('FOR UPDATE SKIP LOCKED'), [
      10,
      30_000,
      expect.any(String),
    ]);
  });

  it('normalizes PostgreSQL UPDATE RETURNING structured results', async () => {
    const entityRepository = { create: jest.fn((value: OutboxMessageEntity) => value) };
    const row = {
      id: '11111111-1111-4111-8111-111111111111',
      topic: 'mail.send',
      version: 1,
      payload: { template: 'email-verification' },
      correlation_id: 'correlation-1',
      status: 'processing',
      attempts: 1,
      available_at: new Date().toISOString(),
      lease_until: new Date().toISOString(),
      lease_token: '22222222-2222-4222-8222-222222222222',
      last_error_code: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    const manager = {
      query: jest.fn().mockResolvedValue([[row], 1]),
      getRepository: jest.fn().mockReturnValue(entityRepository),
    } as unknown as EntityManager;
    const dataSource = {
      transaction: jest.fn(
        async (callback: (value: EntityManager) => Promise<OutboxMessageEntity[]>) =>
          callback(manager),
      ),
    } as unknown as DataSource;

    const records = await new OutboxRepository(dataSource).claimBatch(10, 30_000);
    expect(records[0]).toEqual(
      expect.objectContaining({
        id: row.id,
        topic: row.topic,
        correlationId: row.correlation_id,
        payload: row.payload,
      }),
    );
    expect(entityRepository.create).toHaveBeenCalledTimes(1);
  });

  it('marks publication state only for the current lease token', async () => {
    const dataSource = { query: jest.fn().mockResolvedValue(undefined) } as unknown as DataSource;
    const repository = new OutboxRepository(dataSource);

    await repository.markPublished('id', 'lease');
    await repository.markFailed('id', 'lease', 'SMTP_EXHAUSTED');
    expect(dataSource.query).toHaveBeenCalledTimes(2);
    expect(dataSource.query).toHaveBeenLastCalledWith(
      expect.stringContaining("status = 'failed'"),
      ['id', 'lease', 'SMTP_EXHAUSTED'],
    );
  });

  it('deletes only old published and terminal failed rows in a bounded transaction', async () => {
    const manager = {
      query: jest.fn().mockResolvedValue({ rowCount: 3 }),
    } as unknown as EntityManager;
    const dataSource = {
      transaction: jest.fn(async (callback: (value: EntityManager) => Promise<number>) =>
        callback(manager),
      ),
    } as unknown as DataSource;
    const repository = new OutboxRepository(dataSource);

    await expect(
      repository.cleanupProcessed(new Date('2026-01-01'), new Date('2025-01-01'), 25),
    ).resolves.toBe(3);
    expect(manager.query).toHaveBeenCalledWith(expect.stringContaining("status = 'published'"), [
      new Date('2026-01-01'),
      new Date('2025-01-01'),
      25,
    ]);
  });

  it('treats an adapter response without a row count as an empty cleanup', async () => {
    const manager = { query: jest.fn().mockResolvedValue(undefined) } as unknown as EntityManager;
    const dataSource = {
      transaction: jest.fn(async (callback: (value: EntityManager) => Promise<number>) =>
        callback(manager),
      ),
    } as unknown as DataSource;

    await expect(
      new OutboxRepository(dataSource).cleanupProcessed(new Date(), new Date(), 1),
    ).resolves.toBe(0);
  });
});
