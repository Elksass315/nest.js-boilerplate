import type { QueryRunner } from 'typeorm';

import { AddSessionMetadata1787443200000 } from './migrations/1787443200000-AddSessionMetadata';

describe(AddSessionMetadata1787443200000.name, () => {
  it('adds and reverses nullable session context columns', async () => {
    const query = jest.fn().mockResolvedValue([]);
    const migration = new AddSessionMetadata1787443200000();
    const runner = { query } as unknown as QueryRunner;

    await migration.up(runner);
    expect(query).toHaveBeenCalledWith(expect.stringContaining('"ip_address" varchar(64)'));
    expect(query).toHaveBeenCalledWith(expect.stringContaining('"device_metadata" jsonb'));
    expect(query).toHaveBeenCalledWith(expect.stringContaining('"approximate_location" jsonb'));

    query.mockClear();
    await migration.down(runner);
    expect(query).toHaveBeenCalledWith(expect.stringContaining('DROP COLUMN "ip_address"'));
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('DROP COLUMN "approximate_location"'),
    );
  });
});
