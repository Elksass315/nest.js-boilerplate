import { Injectable } from '@nestjs/common';
import type { Job } from 'bullmq';
import { PinoLogger } from 'nestjs-pino';

import { MailRepository } from './mail.repository';
import type { MailJob } from './mail.types';
import { SmtpProvider } from './smtp.provider';
import { TemplateRendererService } from './template-renderer.service';

@Injectable()
export class MailProcessor {
  public constructor(
    private readonly renderer: TemplateRendererService,
    private readonly smtp: SmtpProvider,
    private readonly repository: MailRepository,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(MailProcessor.name);
  }

  public async process(job: Job<MailJob>): Promise<void> {
    const attempts = job.attemptsMade + 1;
    const context = {
      deliveryId: job.data.deliveryId,
      jobId: job.id ?? null,
      template: job.data.template,
      attempt: attempts,
      correlationId: job.data.correlationId,
    };
    await this.repository.markProcessing(job.data.deliveryId, attempts);
    this.logger.info(context, 'Mail delivery started');
    try {
      const html = this.renderer.render(job.data.template, job.data.subject, job.data.context);
      await this.smtp.send({
        fromAddress: job.data.fromAddress,
        fromName: job.data.fromName,
        to: job.data.to,
        subject: job.data.subject,
        html,
      });
      await this.repository.markSent(job.data.deliveryId, attempts);
      this.logger.info(context, 'Mail delivery completed');
    } catch (error) {
      const maximumAttempts = job.opts.attempts ?? 1;
      if (attempts >= maximumAttempts) {
        await this.repository.markFailed(job.data.deliveryId, attempts, 'SMTP_DELIVERY_FAILED');
      }
      this.logger.error({ ...context, errorType: errorName(error) }, 'Mail delivery failed');
      throw new Error('Mail delivery failed', { cause: error });
    }
  }
}

function errorName(error: unknown): string {
  return error instanceof Error ? error.name : 'UnknownError';
}
