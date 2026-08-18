import { PATH_METADATA, VERSION_METADATA } from '@nestjs/common/constants';

import { API_VERSION } from '@/common/http/api-version.constants';
import type { AuthenticatedPrincipal } from '@/modules/authorization';

import type { CreateInvitationDto } from './dto/create-invitation.dto';
import { InvitationsController } from './invitations.controller';
import type { InvitationsService } from './invitations.service';

describe(InvitationsController.name, () => {
  const service = {
    create: jest.fn(),
    list: jest.fn(),
    getById: jest.fn(),
    resend: jest.fn(),
    revoke: jest.fn(),
  };
  const controller = new InvitationsController(service as unknown as InvitationsService);
  const principal = {
    userId: '889e25cb-ded9-4eb8-a2d6-8f058cc96580',
    authVersion: 1,
    roleKeys: ['admin'],
    permissions: [],
  } satisfies AuthenticatedPrincipal;

  beforeEach(() => jest.clearAllMocks());

  it('registers the versioned team route', () => {
    expect(Reflect.getMetadata(PATH_METADATA, InvitationsController)).toBe('team/invitations');
    expect(Reflect.getMetadata(VERSION_METADATA, InvitationsController)).toBe(API_VERSION);
  });

  it('delegates validated creation input with the principal', async () => {
    const body = { email: 'new.member@example.com', role: 'user' } satisfies CreateInvitationDto;
    service.create.mockResolvedValue({ id: 'invitation-id' });

    await controller.create(body, principal);

    expect(service.create).toHaveBeenCalledWith(body.email, body.role, principal);
  });
});
