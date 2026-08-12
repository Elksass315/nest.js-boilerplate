export const MAIL_QUEUE = 'mail';

export type MailTemplate = 'email-verification' | 'reset-password';

export interface MailJob {
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
  token: string;
  expiresInSeconds: number;
}

export type PasswordResetMailInput = VerificationMailInput;
