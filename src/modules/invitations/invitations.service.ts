import { createHash, randomBytes } from 'node:crypto';

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, type EntityManager } from 'typeorm';

import { buildOffsetPage, type OffsetPage } from '@/common/pagination';
import type { AppConfiguration } from '@/config/configuration.types';
import { AppException } from '@/core/errors/app.exception';
import type { AuthenticatedPrincipal, RoleDefinition, RoleKey } from '@/modules/authorization';
import { AuthorizationService } from '@/modules/authorization';
import { AuthService } from '@/modules/auth';
import { MailService } from '@/modules/mail';
import { UsersService } from '@/modules/users';
import { isPlainRecord } from '@/shared/helpers/is-plain-record';

import type { InvitationResponseDto } from './dto/invitation-response.dto';
import type { InvitationEntity } from './entities/invitation.entity';
import { InvitationsRepository } from './invitations.repository';

@Injectable()
export class InvitationsService {
  public constructor(
    private readonly repository: InvitationsRepository,
    private readonly authorization: AuthorizationService,
    private readonly auth: AuthService,
    private readonly users: UsersService,
    private readonly mail: MailService,
    private readonly config: ConfigService<AppConfiguration, true>,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  public async accept(token: string, fullName: string, password: string): Promise<void> {
    const tokenHash = this.hashToken(token);
    const now = new Date();
    this.assertAcceptableInvitation(await this.repository.findByTokenHash(tokenHash), now);
    const passwordHash = await this.auth.hashAccountPassword(password);
    await this.dataSource.transaction(async (manager) => {
      const invitation = await this.repository.findByTokenHashForUpdate(manager, tokenHash);
      this.assertAcceptableInvitation(invitation, now);
      const user = await this.users.createInvitedUser(
        manager,
        {
          fullName: fullName.trim(),
          email: invitation.email,
          normalizedEmail: invitation.normalizedEmail,
          passwordHash,
        },
        invitation.roleId,
        invitation.id,
      );
      invitation.status = 'accepted';
      invitation.acceptedByUserId = user.id;
      invitation.acceptedAt = now;
      invitation.tokenHash = this.hashToken(randomBytes(32).toString('base64url'));
      await this.repository.save(manager, invitation);
      await this.mail.sendInvitationAccepted(
        { email: user.email, fullName: user.fullName, occurredAt: now },
        manager,
      );
    });
  }

  private assertAcceptableInvitation(
    invitation: InvitationEntity | null,
    now: Date,
  ): asserts invitation is InvitationEntity {
    if (!invitation) throw new AppException('INVALID_INVITATION_TOKEN');
    if (invitation.status !== 'pending') throw new AppException('INVITATION_NOT_PENDING');
    if (invitation.expiresAt.getTime() <= now.getTime()) {
      throw new AppException('INVITATION_EXPIRED');
    }
  }

  public async list(page: number, limit: number): Promise<OffsetPage<InvitationResponseDto>> {
    const [invitations, total] = await this.repository.findPage(page, limit);
    return buildOffsetPage(
      invitations.map((invitation) => this.toResponse(invitation)),
      total,
      page,
      limit,
    );
  }

  public async getById(id: string): Promise<InvitationResponseDto> {
    const invitation = await this.repository.findById(id);
    if (!invitation) throw new AppException('INVITATION_NOT_FOUND');
    return this.toResponse(invitation);
  }

  public async create(
    email: string,
    roleKey: RoleKey,
    principal: AuthenticatedPrincipal,
  ): Promise<InvitationResponseDto> {
    const normalizedEmail = email.trim().toLowerCase();
    if (await this.users.emailExists(normalizedEmail)) {
      throw new AppException('MEMBER_ALREADY_EXISTS');
    }
    const role = await this.authorization.getRequiredRole(roleKey);
    this.assertAssignableRole(principal, role);
    const token = randomBytes(32).toString('base64url');
    const now = new Date();
    const invitation = await this.dataSource
      .transaction(async (manager) => {
        const existing = await this.repository.findPendingByEmailForUpdate(
          manager,
          normalizedEmail,
        );
        if (existing && existing.expiresAt.getTime() > now.getTime()) {
          throw new AppException('INVITATION_ALREADY_PENDING');
        }
        if (existing) {
          existing.status = 'expired';
          await this.repository.save(manager, existing);
        }
        const invitation = await this.repository.create(manager, {
          email: email.trim(),
          normalizedEmail,
          roleId: role.id,
          roleKey: role.key,
          status: 'pending',
          tokenHash: this.hashToken(token),
          invitedByUserId: principal.userId,
          acceptedByUserId: null,
          expiresAt: this.expirationFrom(now),
          acceptedAt: null,
          revokedAt: null,
          lastSentAt: now,
          sendCount: 1,
        });
        await this.sendInvitation(invitation, token, principal.userId, manager);
        await this.users.recordSecurityAudit(
          principal.userId,
          'team.invitation.created',
          { invitationId: invitation.id, role: invitation.roleKey },
          manager,
        );
        return invitation;
      })
      .catch((error: unknown) => {
        if (this.isPendingEmailConflict(error)) {
          throw new AppException('INVITATION_ALREADY_PENDING');
        }
        throw error;
      });
    return this.toResponse(invitation);
  }

  public async resend(
    id: string,
    principal: AuthenticatedPrincipal,
  ): Promise<InvitationResponseDto> {
    const token = randomBytes(32).toString('base64url');
    const now = new Date();
    const invitation = await this.dataSource.transaction(async (manager) => {
      const current = await this.repository.findByIdForUpdate(manager, id);
      if (!current) throw new AppException('INVITATION_NOT_FOUND');
      if (current.status !== 'pending') throw new AppException('INVITATION_NOT_PENDING');
      if (current.expiresAt.getTime() <= now.getTime()) {
        throw new AppException('INVITATION_EXPIRED');
      }
      const invitationConfig = this.config.getOrThrow('invitations', { infer: true });
      if (current.sendCount >= invitationConfig.maxSends) {
        throw new AppException('INVITATION_RESEND_LIMIT_REACHED');
      }
      if (
        now.getTime() - current.lastSentAt.getTime() <
        invitationConfig.resendCooldownSeconds * 1000
      ) {
        throw new AppException('INVITATION_RESEND_TOO_SOON');
      }
      current.tokenHash = this.hashToken(token);
      current.lastSentAt = now;
      current.expiresAt = this.expirationFrom(now);
      current.sendCount += 1;
      const saved = await this.repository.save(manager, current);
      await this.sendInvitation(saved, token, principal.userId, manager);
      await this.users.recordSecurityAudit(
        principal.userId,
        'team.invitation.resent',
        { invitationId: saved.id },
        manager,
      );
      return saved;
    });
    return this.toResponse(invitation);
  }

  public async revoke(id: string, principal: AuthenticatedPrincipal): Promise<void> {
    const changed = await this.dataSource.transaction(async (manager) => {
      const invitation = await this.repository.findByIdForUpdate(manager, id);
      if (!invitation) throw new AppException('INVITATION_NOT_FOUND');
      if (invitation.status === 'revoked') return false;
      if (invitation.status !== 'pending') throw new AppException('INVITATION_NOT_PENDING');
      invitation.status = 'revoked';
      invitation.revokedAt = new Date();
      await this.repository.save(manager, invitation);
      return true;
    });
    if (changed) {
      await this.users.recordSecurityAudit(principal.userId, 'team.invitation.revoked', {
        invitationId: id,
      });
    }
  }

  private assertAssignableRole(principal: AuthenticatedPrincipal, role: RoleDefinition): void {
    if (principal.roleKeys.includes('super_admin')) return;
    if (principal.roleKeys.includes('admin') && role.key === 'user') return;
    throw new AppException('ROLE_ASSIGNMENT_FORBIDDEN');
  }

  private async sendInvitation(
    invitation: InvitationEntity,
    token: string,
    actorUserId: string,
    manager?: EntityManager,
  ): Promise<void> {
    const inviter = await this.users.getSelf(actorUserId);
    const actionUrl = new URL(this.config.getOrThrow('invitations.baseUrl', { infer: true }));
    actionUrl.searchParams.set('token', token);
    try {
      await this.mail.sendTeamInvitation(
        {
          email: invitation.email,
          inviterName: inviter.fullName,
          role: invitation.roleKey,
          actionUrl: actionUrl.toString(),
          expiresAt: invitation.expiresAt,
        },
        manager,
      );
    } catch {
      throw new AppException('INVITATION_DELIVERY_UNAVAILABLE');
    }
  }

  private expirationFrom(date: Date): Date {
    const ttlHours = this.config.getOrThrow('invitations.ttlHours', { infer: true });
    return new Date(date.getTime() + ttlHours * 60 * 60 * 1000);
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private isPendingEmailConflict(error: unknown): boolean {
    return (
      isPlainRecord(error) &&
      error['code'] === '23505' &&
      error['constraint'] === 'UQ_team_invitations_pending_email'
    );
  }

  private toResponse(invitation: InvitationEntity): InvitationResponseDto {
    return {
      id: invitation.id,
      email: invitation.email,
      role: invitation.roleKey,
      status: invitation.status,
      invitedByUserId: invitation.invitedByUserId,
      expiresAt: invitation.expiresAt.toISOString(),
      lastSentAt: invitation.lastSentAt.toISOString(),
      sendCount: invitation.sendCount,
      createdAt: invitation.createdAt.toISOString(),
      updatedAt: invitation.updatedAt.toISOString(),
    };
  }
}
