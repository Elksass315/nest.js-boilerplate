import type { QueryRunner } from 'typeorm';

import { securityAuditRbacSeed } from './004-security-audit-rbac.seed';

describe('security-audit RBAC seed', () => {
  it('assigns cross-user audit lookup only to the super-administrator role', async () => {
    const query = jest.fn().mockResolvedValue([]);

    await securityAuditRbacSeed.run({ query } as unknown as QueryRunner);

    expect(query).toHaveBeenCalledTimes(2);
    expect(query).toHaveBeenNthCalledWith(1, expect.stringContaining('authorization_permissions'), [
      '20000000-0000-4000-8000-000000000010',
      'users.security-audits.read.any',
      'Read security-audit history across user accounts.',
    ]);
    expect(query).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('authorization_role_permissions'),
      [
        '30000000-0000-4000-8000-000000000015',
        '10000000-0000-4000-8000-000000000001',
        '20000000-0000-4000-8000-000000000010',
      ],
    );
  });
});
