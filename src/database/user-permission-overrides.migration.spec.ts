import type { QueryRunner } from 'typeorm';

import { CreateUserPermissionOverrides1787529600000 } from './migrations/1787529600000-CreateUserPermissionOverrides';

describe(CreateUserPermissionOverrides1787529600000.name, () => {
  it('creates constrained override storage and reverses it', async () => {
    const query = jest.fn().mockResolvedValue([]);
    const migration = new CreateUserPermissionOverrides1787529600000();
    const runner = { query } as unknown as QueryRunner;

    await migration.up(runner);

    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('CREATE TABLE "user_permission_overrides"'),
    );
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('UQ_user_permission_overrides_user_permission'),
    );
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("CHECK (\"effect\" IN ('grant', 'revoke'))"),
    );
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('IDX_user_permission_overrides_permission_id'),
    );

    query.mockClear();
    await migration.down(runner);
    expect(query).toHaveBeenCalledWith('DROP TABLE "user_permission_overrides"');
  });
});
