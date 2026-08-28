import { OUTBOX_MAIL_QUEUE } from '@/core/outbox/outbox.types';

export const MAIL_QUEUE = OUTBOX_MAIL_QUEUE;

export type MailTemplate =
  | 'email-verification'
  | 'reset-password'
  | 'two-step-code'
  | 'new-session'
  | 'session-revoked'
  | 'password-changed'
  | 'two-step-changed'
  | 'account-status-changed'
  | 'role-changed'
  | 'team-invitation'
  | 'team-invitation-accepted';

export type MailDeliveryStatus = 'queued' | 'processing' | 'sent' | 'failed';

export interface MailJob {
  deliveryId: string;
  to: string;
  fromAddress: string;
  fromName: string;
  subject: string;
  template: MailTemplate;
  context: Record<string, unknown>;
  correlationId: string | null;
}

export interface VerificationMailInput {
  email: string;
  fullName: string;
  code: string;
  expiresInSeconds: number;
}

export interface PasswordResetMailInput {
  email: string;
  fullName: string;
  token: string;
  expiresInSeconds: number;
}

export interface TwoStepCodeMailInput {
  email: string;
  fullName: string;
  code: string;
  expiresInSeconds: number;
  purpose: 'login' | 'enable' | 'disable' | 'recovery_regenerate';
}

export interface SecurityMailInput {
  email: string;
  fullName: string;
  occurredAt: Date;
}

export interface TwoStepChangedMailInput extends SecurityMailInput {
  enabled: boolean;
}

export interface AccountStatusChangedMailInput extends SecurityMailInput {
  status: string;
}

export interface RoleChangedMailInput extends SecurityMailInput {
  roles: readonly string[];
}

export interface TeamInvitationMailInput {
  email: string;
  inviterName: string;
  role: string;
  token: string;
  expiresAt: Date;
}

export type InvitationAcceptedMailInput = SecurityMailInput;
