import { teamInvitationsRbacSeed } from './003-team-invitations-rbac.seed';

describe('team invitation RBAC seed', () => {
  it('adds four permissions to both administrative roles', async () => {
    const query = jest.fn().mockResolvedValue([]);
    await teamInvitationsRbacSeed.run({ query });

    expect(query).toHaveBeenCalledTimes(12);
    expect(query).toHaveBeenCalledWith(expect.stringContaining('authorization_permissions'), [
      '20000000-0000-4000-8000-000000000006',
      'team.invitations.read',
      'Read team invitation records.',
    ]);
  });
});
