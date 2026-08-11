import type { QueryRunner } from 'typeorm';

import { rbacSeed } from './002-rbac.seed';

describe('RBAC seed', () => {
  it('inserts all fixed roles, permissions, and effective assignments', async () => {
    const query = jest.fn().mockResolvedValue([]);
    const runner = { query } as unknown as QueryRunner;

    await rbacSeed.run(runner);

    expect(query).toHaveBeenCalledTimes(14);
    expect(query).toHaveBeenCalledWith(expect.stringContaining('authorization_roles'), [
      '10000000-0000-4000-8000-000000000001',
      'super_admin',
      'Super administrator',
      'Full platform security administration.',
    ]);
    expect(query).toHaveBeenCalledWith(expect.stringContaining('authorization_permissions'), [
      '20000000-0000-4000-8000-000000000001',
      'users.read',
      'Read user account records.',
    ]);
    expect(rbacSeed.checksumSource).toEqual(
      expect.objectContaining({ superAdminPermissionIds: expect.any(Array) }),
    );
  });
});
