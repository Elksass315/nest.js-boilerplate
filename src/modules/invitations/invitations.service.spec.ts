import type { ConfigService } from '@nestjs/config';
import type { DataSource, EntityManager } from 'typeorm';

import type { AppConfiguration } from '@/config/configuration.types';
import { AppException } from '@/core/errors/app.exception';
import type { AuthenticatedPrincipal, AuthorizationService } from '@/modules/authorization';
import type { AuthService } from '@/modules/auth';
import type { MailService } from '@/modules/mail';
import type { UsersService } from '@/modules/users';

import type { InvitationEntity } from './entities/invitation.entity';
import type { InvitationsRepository } from './invitations.repository';
import { InvitationsService } from './invitations.service';

describe(InvitationsService.name, () => {
  async function expectErrorCode(promise: Promise<unknown>, code: string): Promise<void> {
    try {
      await promise;
      throw new Error(`Expected ${code}`);
    } catch (error) {
      if (!(error instanceof AppException)) throw error;
      expect(error.getResponse()).toEqual(expect.objectContaining({ code }));
    }
  }

  const manager = {} as EntityManager;
  const repository = {
    findPage: jest.fn(),
    findById: jest.fn(),
    findByTokenHash: jest.fn(),
    findByIdForUpdate: jest.fn(),
    findByTokenHashForUpdate: jest.fn(),
    findPendingByEmailForUpdate: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };
  const authorization = { getRequiredRole: jest.fn() };
  const auth = { hashAccountPassword: jest.fn() };
  const users = {
    emailExists: jest.fn(),
    getSelf: jest.fn(),
    recordSecurityAudit: jest.fn(),
    createInvitedUser: jest.fn(),
  };
  const mail = { sendTeamInvitation: jest.fn(), sendInvitationAccepted: jest.fn() };
  const config = {
    getOrThrow: jest.fn((key: string) => {
      if (key === 'invitations.ttlHours') return 72;
      if (key === 'invitations.baseUrl') return 'https://app.example.test/invitations/accept';
      if (key === 'invitations') {
        return { ttlHours: 72, maxSends: 5, resendCooldownSeconds: 60 };
      }
      throw new Error(`Unexpected config key ${key}`);
    }),
  };
  const dataSource = {
    transaction: jest.fn((work: (transactionManager: EntityManager) => unknown) => work(manager)),
  };
  const service = new InvitationsService(
    repository as unknown as InvitationsRepository,
    authorization as unknown as AuthorizationService,
    auth as unknown as AuthService,
    users as unknown as UsersService,
    mail as unknown as MailService,
    config as unknown as ConfigService<AppConfiguration, true>,
    dataSource as unknown as DataSource,
  );
  const principal: AuthenticatedPrincipal = {
    userId: '889e25cb-ded9-4eb8-a2d6-8f058cc96580',
    authVersion: 1,
    roleKeys: ['admin'],
    permissions: [
      'team.invitations.read',
      'team.invitations.create',
      'team.invitations.resend',
      'team.invitations.revoke',
    ],
  };

  beforeEach(() => {
    jest.clearAllMocks();
    users.emailExists.mockResolvedValue(false);
    users.getSelf.mockResolvedValue({ fullName: 'Admin User' });
    users.recordSecurityAudit.mockResolvedValue(undefined);
    authorization.getRequiredRole.mockResolvedValue({
      id: '10000000-0000-4000-8000-000000000003',
      key: 'user',
      name: 'User',
      description: 'Standard user',
      permissions: [],
    });
    repository.findPendingByEmailForUpdate.mockResolvedValue(null);
    repository.findByTokenHash.mockResolvedValue(invitation());
    mail.sendTeamInvitation.mockResolvedValue(undefined);
    mail.sendInvitationAccepted.mockResolvedValue(undefined);
    auth.hashAccountPassword.mockResolvedValue('$argon2id$invited');
    users.createInvitedUser.mockResolvedValue({
      id: '7b3f8ed4-73ef-4afe-8703-b10dd32f3820',
      fullName: 'Amina Hassan',
      email: 'new.member@example.com',
    });
  });

  it('atomically creates an active invited user and consumes the token without logging in', async () => {
    const pending = invitation();
    repository.findByTokenHash.mockResolvedValue(pending);
    repository.findByTokenHashForUpdate.mockResolvedValue(pending);
    repository.save.mockResolvedValue(pending);

    await service.accept('t'.repeat(43), ' Amina Hassan ', 'strong-password');

    expect(auth.hashAccountPassword).toHaveBeenCalledWith('strong-password');
    expect(users.createInvitedUser).toHaveBeenCalledWith(
      manager,
      expect.objectContaining({
        fullName: 'Amina Hassan',
        normalizedEmail: pending.normalizedEmail,
        passwordHash: '$argon2id$invited',
      }),
      pending.roleId,
      pending.id,
    );
    expect(pending).toEqual(
      expect.objectContaining({
        status: 'accepted',
        acceptedByUserId: '7b3f8ed4-73ef-4afe-8703-b10dd32f3820',
        acceptedAt: expect.any(Date),
      }),
    );
    expect(pending.tokenHash).not.toBe('a'.repeat(64));
    expect(mail.sendInvitationAccepted).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'new.member@example.com' }),
      expect.anything(),
    );
  });

  it('rejects unknown, expired, and terminal invitation tokens before user creation', async () => {
    repository.findByTokenHash.mockResolvedValueOnce(null);
    await expectErrorCode(
      service.accept('u'.repeat(43), 'Amina Hassan', 'strong-password'),
      'INVALID_INVITATION_TOKEN',
    );

    repository.findByTokenHash.mockResolvedValueOnce(
      invitation({ expiresAt: new Date(Date.now() - 1) }),
    );
    await expectErrorCode(
      service.accept('e'.repeat(43), 'Amina Hassan', 'strong-password'),
      'INVITATION_EXPIRED',
    );

    repository.findByTokenHash.mockResolvedValueOnce(invitation({ status: 'revoked' }));
    await expectErrorCode(
      service.accept('r'.repeat(43), 'Amina Hassan', 'strong-password'),
      'INVITATION_NOT_PENDING',
    );
    expect(users.createInvitedUser).not.toHaveBeenCalled();
    expect(auth.hashAccountPassword).not.toHaveBeenCalled();
  });

  it('creates a normalized, hashed invitation and sends the raw token only to mail', async () => {
    repository.create.mockImplementation(
      (_manager: EntityManager, input: Partial<InvitationEntity>) =>
        Promise.resolve(invitation(input)),
    );

    const result = await service.create(' New.Member@Example.com ', 'user', principal);

    expect(repository.create).toHaveBeenCalledWith(
      manager,
      expect.objectContaining({
        email: 'New.Member@Example.com',
        normalizedEmail: 'new.member@example.com',
        tokenHash: expect.stringMatching(/^[a-f\d]{64}$/),
      }),
    );
    expect(mail.sendTeamInvitation).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'New.Member@Example.com',
        actionUrl: expect.stringMatching(
          /^https:\/\/app\.example\.test\/invitations\/accept\?token=.+/u,
        ),
      }),
      expect.anything(),
    );
    expect(result).not.toHaveProperty('tokenHash');
    expect(users.recordSecurityAudit).toHaveBeenCalledWith(
      principal.userId,
      'team.invitation.created',
      expect.objectContaining({ invitationId: result.id }),
      expect.anything(),
    );
  });

  it('allows a super administrator to assign an administrative role', async () => {
    const superAdmin: AuthenticatedPrincipal = { ...principal, roleKeys: ['super_admin'] };
    authorization.getRequiredRole.mockResolvedValue({
      id: '10000000-0000-4000-8000-000000000002',
      key: 'admin',
      name: 'Administrator',
      description: 'Administrator',
      permissions: [],
    });
    repository.create.mockImplementation(
      (_manager: EntityManager, input: Partial<InvitationEntity>) =>
        Promise.resolve(invitation(input)),
    );

    await service.create('member@example.com', 'admin', superAdmin);

    expect(repository.create).toHaveBeenCalledWith(
      manager,
      expect.objectContaining({ roleKey: 'admin' }),
    );
  });

  it('rejects an unexpired pending invitation for the normalized email', async () => {
    repository.findPendingByEmailForUpdate.mockResolvedValue(invitation());

    await expectErrorCode(
      service.create('member@example.com', 'user', principal),
      'INVITATION_ALREADY_PENDING',
    );
  });

  it('prevents admins from assigning an administrative role', async () => {
    authorization.getRequiredRole.mockResolvedValue({
      id: '10000000-0000-4000-8000-000000000002',
      key: 'admin',
      name: 'Administrator',
      description: 'Administrator',
      permissions: [],
    });

    await expectErrorCode(
      service.create('member@example.com', 'admin', principal),
      'ROLE_ASSIGNMENT_FORBIDDEN',
    );
    expect(repository.create).not.toHaveBeenCalled();
  });

  it('rejects an email already owned by a member', async () => {
    users.emailExists.mockResolvedValue(true);

    await expectErrorCode(
      service.create('member@example.com', 'user', principal),
      'MEMBER_ALREADY_EXISTS',
    );
  });

  it('enforces resend cooldown without rotating the token', async () => {
    repository.findByIdForUpdate.mockResolvedValue(
      invitation({ lastSentAt: new Date(), expiresAt: new Date(Date.now() + 60_000) }),
    );

    await expectErrorCode(service.resend('invitation-id', principal), 'INVITATION_RESEND_TOO_SOON');
    expect(repository.save).not.toHaveBeenCalled();
  });

  it('commits token rotation, audit, and durable mail request on resend', async () => {
    const pending = invitation();
    repository.findByIdForUpdate.mockResolvedValue(pending);
    repository.save.mockResolvedValue(pending);

    await service.resend(pending.id, principal);

    expect(repository.save).toHaveBeenCalledWith(manager, pending);
    expect(mail.sendTeamInvitation).toHaveBeenCalledWith(
      expect.objectContaining({
        email: pending.email,
        actionUrl: expect.stringContaining('token='),
      }),
      manager,
    );
    expect(users.recordSecurityAudit).toHaveBeenCalledWith(
      principal.userId,
      'team.invitation.resent',
      { invitationId: pending.id },
      manager,
    );
  });

  it('rejects resend after invitation expiry', async () => {
    repository.findByIdForUpdate.mockResolvedValue(
      invitation({ expiresAt: new Date(Date.now() - 1) }),
    );

    await expectErrorCode(service.resend('invitation-id', principal), 'INVITATION_EXPIRED');
  });

  it('rejects resend after the configured send limit', async () => {
    repository.findByIdForUpdate.mockResolvedValue(invitation({ sendCount: 5 }));

    await expectErrorCode(
      service.resend('invitation-id', principal),
      'INVITATION_RESEND_LIMIT_REACHED',
    );
  });

  it('returns the stable delivery error when mail enqueue fails', async () => {
    repository.create.mockImplementation(
      (_manager: EntityManager, input: Partial<InvitationEntity>) =>
        Promise.resolve(invitation(input)),
    );
    mail.sendTeamInvitation.mockRejectedValue(new Error('queue unavailable'));

    await expectErrorCode(
      service.create('member@example.com', 'user', principal),
      'INVITATION_DELIVERY_UNAVAILABLE',
    );
  });

  it('revokes a pending invitation idempotently and audits only the first change', async () => {
    const pending = invitation();
    repository.findByIdForUpdate.mockResolvedValueOnce(pending);
    repository.save.mockResolvedValue(pending);

    await service.revoke(pending.id, principal);
    expect(pending.status).toBe('revoked');
    expect(users.recordSecurityAudit).toHaveBeenCalledTimes(1);

    repository.findByIdForUpdate.mockResolvedValueOnce(pending);
    await service.revoke(pending.id, principal);
    expect(users.recordSecurityAudit).toHaveBeenCalledTimes(1);
  });
});

function invitation(overrides: Partial<InvitationEntity> = {}): InvitationEntity {
  return {
    id: '516f56de-a801-47ea-b178-6d64b55da325',
    email: 'new.member@example.com',
    normalizedEmail: 'new.member@example.com',
    roleId: '10000000-0000-4000-8000-000000000003',
    roleKey: 'user',
    status: 'pending',
    tokenHash: 'a'.repeat(64),
    invitedByUserId: '889e25cb-ded9-4eb8-a2d6-8f058cc96580',
    acceptedByUserId: null,
    expiresAt: new Date(Date.now() + 72 * 60 * 60 * 1000),
    acceptedAt: null,
    revokedAt: null,
    lastSentAt: new Date(Date.now() - 120_000),
    sendCount: 1,
    createdAt: new Date('2026-08-18T12:00:00.000Z'),
    updatedAt: new Date('2026-08-18T12:00:00.000Z'),
    ...overrides,
  };
}
