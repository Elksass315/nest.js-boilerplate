import { createInvitationsConfig } from './invitations.config';

describe('invitations configuration', () => {
  it('maps invitation delivery policies', () => {
    expect(
      createInvitationsConfig({
        TEAM_INVITATION_BASE_URL: 'https://app.example.com/invitations/accept',
        TEAM_INVITATION_TTL_HOURS: 72,
        TEAM_INVITATION_MAX_SENDS: 5,
        TEAM_INVITATION_RESEND_COOLDOWN_SECONDS: 60,
      }),
    ).toEqual({
      baseUrl: 'https://app.example.com/invitations/accept',
      ttlHours: 72,
      maxSends: 5,
      resendCooldownSeconds: 60,
    });
  });
});
