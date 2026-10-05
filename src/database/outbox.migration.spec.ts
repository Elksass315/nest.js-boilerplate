import type { QueryRunner } from 'typeorm';

import { CreateTransactionalOutbox1787600000000 } from './migrations/1787600000000-CreateTransactionalOutbox';

describe('CreateTransactionalOutbox1787600000000', () => {
  it('creates and removes the durable outbox schema', async () => {
    const runner = {
      query: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<QueryRunner>;
    const migration = new CreateTransactionalOutbox1787600000000();

    await migration.up(runner);
    await migration.down(runner);

    expect(runner.query).toHaveBeenCalledTimes(3);
    expect(runner.query.mock.calls[0]?.[0]).toContain('CREATE TABLE "outbox_messages"');
    expect(runner.query.mock.calls[1]?.[0]).toContain('IDX_outbox_messages_claim');
    expect(runner.query.mock.calls[2]?.[0]).toContain('DROP TABLE "outbox_messages"');
  });
});
