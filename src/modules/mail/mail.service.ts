import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource } from '@nestjs/typeorm';
import type { DataSource, EntityManager } from 'typeorm';

import type { AppConfiguration } from '@/config/configuration.types';
import { RequestContextService } from '@/core/request-context/request-context.service';
import { OutboxRepository } from '@/core/outbox/outbox.repository';

import { MailRepository } from './mail.repository';
import {
  type AccountStatusChangedMailInput,
  type InvitationAcceptedMailInput,
  type MailJob,
  type MailTemplate,
  type PasswordResetMailInput,
  type RoleChangedMailInput,
  type SecurityMailInput,
  type TwoStepChangedMailInput,
  type TwoStepCodeMailInput,
  type TeamInvitationMailInput,
  type VerificationMailInput,
} from './mail.types';

@Injectable()
export class MailService {
  public constructor(
    private readonly config: ConfigService<AppConfiguration, true>,
    private readonly requestContext: RequestContextService,
    private readonly repository: MailRepository,
    private readonly outbox: OutboxRepository,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  public sendEmailVerification(
    input: VerificationMailInput,
    manager?: EntityManager,
  ): Promise<void> {
    return this.enqueue(
      input.email,
      'email-verification',
      'Verify your email address',
      {
        name: input.fullName,
        code: input.code,
        expiresInMinutes: Math.ceil(input.expiresInSeconds / 60),
      },
      manager,
    );
  }

  public sendPasswordReset(input: PasswordResetMailInput, manager?: EntityManager): Promise<void> {
    return this.enqueueAction(
      input,
      'reset-password',
      'Reset your password',
      'reset-password',
      manager,
    );
  }

  public sendTwoStepCode(input: TwoStepCodeMailInput, manager?: EntityManager): Promise<void> {
    return this.enqueue(
      input.email,
      'two-step-code',
      'Your security code',
      {
        name: input.fullName,
        code: input.code,
        expiresInMinutes: Math.ceil(input.expiresInSeconds / 60),
        purpose: input.purpose,
      },
      manager,
    );
  }

  public sendNewSession(input: SecurityMailInput, manager?: EntityManager): Promise<void> {
    return this.enqueue(
      input.email,
      'new-session',
      'New sign-in to your account',
      {
        name: input.fullName,
        occurredAt: input.occurredAt.toISOString(),
      },
      manager,
    );
  }

  public sendForcedSessionRevocation(
    input: SecurityMailInput,
    manager?: EntityManager,
  ): Promise<void> {
    return this.enqueue(
      input.email,
      'session-revoked',
      'A session was revoked',
      {
        name: input.fullName,
        occurredAt: input.occurredAt.toISOString(),
      },
      manager,
    );
  }

  public sendPasswordChanged(input: SecurityMailInput, manager?: EntityManager): Promise<void> {
    return this.enqueue(
      input.email,
      'password-changed',
      'Your password was changed',
      {
        name: input.fullName,
        occurredAt: input.occurredAt.toISOString(),
      },
      manager,
    );
  }

  public sendTwoStepChanged(
    input: TwoStepChangedMailInput,
    manager?: EntityManager,
  ): Promise<void> {
    return this.enqueue(
      input.email,
      'two-step-changed',
      `Email two-step verification was ${input.enabled ? 'enabled' : 'disabled'}`,
      {
        name: input.fullName,
        enabled: input.enabled,
        occurredAt: input.occurredAt.toISOString(),
      },
      manager,
    );
  }

  public sendAccountStatusChanged(
    input: AccountStatusChangedMailInput,
    manager?: EntityManager,
  ): Promise<void> {
    return this.enqueue(
      input.email,
      'account-status-changed',
      'Your account status changed',
      {
        name: input.fullName,
        status: input.status,
        occurredAt: input.occurredAt.toISOString(),
      },
      manager,
    );
  }

  public sendRoleChanged(input: RoleChangedMailInput, manager?: EntityManager): Promise<void> {
    return this.enqueue(
      input.email,
      'role-changed',
      'Your account roles changed',
      {
        name: input.fullName,
        roles: input.roles.join(', '),
        occurredAt: input.occurredAt.toISOString(),
      },
      manager,
    );
  }

  public sendTeamInvitation(
    input: TeamInvitationMailInput,
    manager?: EntityManager,
  ): Promise<void> {
    const actionUrl = new URL(this.config.getOrThrow('invitations.baseUrl', { infer: true }));
    actionUrl.searchParams.set('token', input.token);
    return this.enqueue(
      input.email,
      'team-invitation',
      'You have been invited to the team',
      {
        inviterName: input.inviterName,
        role: input.role,
        actionUrl: actionUrl.toString(),
        expiresAt: input.expiresAt.toISOString(),
      },
      manager,
    );
  }

  public sendInvitationAccepted(
    input: InvitationAcceptedMailInput,
    manager?: EntityManager,
  ): Promise<void> {
    return this.enqueue(
      input.email,
      'team-invitation-accepted',
      'Your team account is ready',
      {
        name: input.fullName,
        occurredAt: input.occurredAt.toISOString(),
      },
      manager,
    );
  }

  private async enqueueAction(
    input: PasswordResetMailInput,
    template: 'reset-password',
    subject: string,
    actionPath: string,
    manager?: EntityManager,
  ): Promise<void> {
    const actionUrl = new URL(
      actionPath,
      this.config.getOrThrow('mail.actionBaseUrl', { infer: true }),
    );
    actionUrl.searchParams.set('token', input.token);
    await this.enqueue(
      input.email,
      template,
      subject,
      {
        name: input.fullName,
        actionUrl: actionUrl.toString(),
        expiresInMinutes: Math.ceil(input.expiresInSeconds / 60),
      },
      manager,
    );
  }

  private async enqueue(
    recipient: string,
    template: MailTemplate,
    subject: string,
    context: Record<string, unknown>,
    transactionManager?: EntityManager,
  ): Promise<void> {
    if (!this.config.getOrThrow('mail.enabled', { infer: true })) return;
    const write = async (manager: EntityManager): Promise<void> => {
      const delivery = await this.repository.createDelivery(
        recipient,
        template,
        this.requestContext.getCorrelationId() ?? null,
        manager,
      );
      const correlationId = this.requestContext.getCorrelationId() ?? `mail:${delivery.id}`;
      const job: MailJob = {
        deliveryId: delivery.id,
        to: recipient,
        fromAddress: this.config.getOrThrow('mail.fromAddress', { infer: true }),
        fromName: this.config.getOrThrow('mail.fromName', { infer: true }),
        subject,
        template,
        context,
        correlationId,
      };
      await this.outbox.insert(manager, 'mail.send', job, correlationId);
    };
    if (transactionManager) {
      await write(transactionManager);
    } else {
      await this.dataSource.transaction(write);
    }
  }
}
