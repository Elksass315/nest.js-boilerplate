import type { QueryRunner } from 'typeorm';

import { userPermissionOverridesRbacSeed } from './006-user-permission-overrides-rbac.seed';

describe('user-permission-overrides RBAC seed', () => {
  it('assigns permission administration only to the super-administrator role', async () => {
    const query = jest.fn().mockResolvedValue([]);

    await userPermissionOverridesRbacSeed.run({ query } as unknown as QueryRunner);

    expect(query).toHaveBeenCalledTimes(2);
    expect(query).toHaveBeenNthCalledWith(1, expect.stringContaining('authorization_permissions'), [
      '20000000-0000-4000-8000-000000000013',
      'users.permissions.manage',
      'Manage per-user permission grants and revocations.',
    ]);
    expect(query).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('authorization_role_permissions'),
      [
        '30000000-0000-4000-8000-000000000019',
        '10000000-0000-4000-8000-000000000001',
        '20000000-0000-4000-8000-000000000013',
      ],
    );
  });
});
