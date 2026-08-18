import type { QueryRunner } from 'typeorm';

import { IndexSecurityAuditPagination1787184000000 } from './migrations/1787184000000-IndexSecurityAuditPagination';

describe(IndexSecurityAuditPagination1787184000000.name, () => {
  it('creates and reverses the stable subject-time-identifier index', async () => {
    const query = jest.fn().mockResolvedValue([]);
    const migration = new IndexSecurityAuditPagination1787184000000();
    const runner = { query } as unknown as QueryRunner;

    await migration.up(runner);
    expect(query).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('IDX_user_security_audits_user_created_id'),
    );

    query.mockClear();
    await migration.down(runner);
    expect(query).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('IDX_user_security_audits_user_created'),
    );
  });
});
