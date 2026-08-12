import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bullmq';
import type { Queue } from 'bullmq';

import type { AppConfiguration } from '@/config/configuration.types';
import { RequestContextService } from '@/core/request-context/request-context.service';

import {
  MAIL_QUEUE,
  type MailJob,
  type PasswordResetMailInput,
  type VerificationMailInput,
} from './mail.types';

@Injectable()
export class MailService {
  public constructor(
    @InjectQueue(MAIL_QUEUE) private readonly queue: Queue<MailJob>,
    private readonly config: ConfigService<AppConfiguration, true>,
    private readonly requestContext: RequestContextService,
  ) {}

  public sendEmailVerification(input: VerificationMailInput): Promise<void> {
    return this.enqueue(input, 'email-verification', 'Verify your email address', 'verify-email');
  }

  public sendPasswordReset(input: PasswordResetMailInput): Promise<void> {
    return this.enqueue(input, 'reset-password', 'Reset your password', 'reset-password');
  }

  private async enqueue(
    input: VerificationMailInput,
    template: MailJob['template'],
    subject: string,
    actionPath: string,
  ): Promise<void> {
    if (!this.config.getOrThrow('mail.enabled', { infer: true })) return;
    const actionUrl = new URL(
      actionPath,
      this.config.getOrThrow('mail.actionBaseUrl', { infer: true }),
    );
    actionUrl.searchParams.set('token', input.token);
    const job: MailJob = {
      to: input.email,
      fromAddress: this.config.getOrThrow('mail.fromAddress', { infer: true }),
      fromName: this.config.getOrThrow('mail.fromName', { infer: true }),
      subject,
      template,
      context: {
        name: input.fullName,
        actionUrl: actionUrl.toString(),
        expiresInMinutes: Math.ceil(input.expiresInSeconds / 60),
      },
      correlationId: this.requestContext.getCorrelationId() ?? null,
    };
    await this.queue.add('send-mail', job, {
      attempts: this.config.getOrThrow('mail.maxRetries', { infer: true }),
      backoff: {
        type: 'exponential',
        delay: this.config.getOrThrow('mail.retryDelayMs', { infer: true }),
      },
      removeOnComplete: { age: 3600 },
      removeOnFail: { age: 86400 },
    });
  }
}
