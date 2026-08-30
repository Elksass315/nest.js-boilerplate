import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer, { type Transporter } from 'nodemailer';

import type { MailWorkerConfiguration } from '@/config/configuration.types';
import { withTelemetrySpan } from '@/observability/telemetry';

interface SmtpMessage {
  fromAddress: string;
  fromName: string;
  to: string;
  subject: string;
  html: string;
}

@Injectable()
export class SmtpProvider {
  private readonly transporter: Transporter;

  public constructor(config: ConfigService<MailWorkerConfiguration, true>) {
    const username = config.getOrThrow('mail.smtpUsername', { infer: true });
    const password = config.getOrThrow('mail.smtpPassword', { infer: true });
    this.transporter = nodemailer.createTransport({
      host: config.getOrThrow('mail.smtpHost', { infer: true }),
      port: config.getOrThrow('mail.smtpPort', { infer: true }),
      secure: config.getOrThrow('mail.smtpSecure', { infer: true }),
      ...(username.length > 0 ? { auth: { user: username, pass: password } } : {}),
      pool: true,
      maxConnections: 5,
      maxMessages: 100,
      connectionTimeout: config.getOrThrow('mail.smtpConnectionTimeoutMs', { infer: true }),
      greetingTimeout: config.getOrThrow('mail.smtpConnectionTimeoutMs', { infer: true }),
      socketTimeout: config.getOrThrow('mail.smtpSocketTimeoutMs', { infer: true }),
    });
  }

  public async send(message: SmtpMessage): Promise<void> {
    await withTelemetrySpan('smtp.send', { 'mail.provider': 'smtp' }, () =>
      this.transporter
        .sendMail({
          from: { address: message.fromAddress, name: message.fromName },
          to: message.to,
          subject: message.subject,
          html: message.html,
        })
        .then(() => undefined),
    );
  }

  public async verify(): Promise<void> {
    await this.transporter.verify();
  }

  public close(): void {
    this.transporter.close();
  }
}
