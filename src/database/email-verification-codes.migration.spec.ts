import type { QueryRunner } from 'typeorm';

import { CreateEmailVerificationCodes1787356800000 } from './migrations/1787356800000-CreateEmailVerificationCodes';

describe(CreateEmailVerificationCodes1787356800000.name, () => {
  it('invalidates legacy links, creates the bounded code table, and reverses the schema', async () => {
    const query = jest.fn().mockResolvedValue([]);
    const migration = new CreateEmailVerificationCodes1787356800000();
    const runner = { query } as unknown as QueryRunner;

    await migration.up(runner);
    expect(query).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining("purpose\" = 'email_verification'"),
    );
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('CREATE TABLE "auth_email_verification_codes"'),
    );
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('CHK_auth_email_verification_codes_attempts'),
    );

    query.mockClear();
    await migration.down(runner);
    expect(query).toHaveBeenNthCalledWith(1, 'DROP TABLE "auth_email_verification_codes"');
    expect(query).toHaveBeenLastCalledWith(expect.stringContaining("'email_verification'"));
  });
});
