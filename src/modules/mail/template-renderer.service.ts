import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Handlebars from 'handlebars';

import type { AppConfiguration } from '@/config/configuration.types';

import type { MailTemplate } from './mail.types';

@Injectable()
export class TemplateRendererService implements OnModuleInit {
  private readonly templates = new Map<MailTemplate, HandlebarsTemplateDelegate>();
  private layout?: HandlebarsTemplateDelegate;
  private readonly directory = path.join(__dirname, 'templates');

  public constructor(private readonly config: ConfigService<AppConfiguration, true>) {}

  public onModuleInit(): void {
    for (const file of readdirSync(path.join(this.directory, 'partials')).filter((name) =>
      name.endsWith('.hbs'),
    )) {
      Handlebars.registerPartial(
        path.basename(file, '.hbs'),
        readFileSync(path.join(this.directory, 'partials', file), 'utf8'),
      );
    }
    this.layout = Handlebars.compile(
      readFileSync(path.join(this.directory, 'layouts', 'base.hbs'), 'utf8'),
    );
    for (const template of [
      'email-verification',
      'reset-password',
      'two-step-code',
      'new-session',
      'session-revoked',
      'password-changed',
      'two-step-changed',
      'account-status-changed',
      'role-changed',
      'team-invitation',
      'team-invitation-accepted',
    ] as const) {
      this.templates.set(
        template,
        Handlebars.compile(
          readFileSync(path.join(this.directory, 'emails', `${template}.hbs`), 'utf8'),
        ),
      );
    }
  }

  public render(template: MailTemplate, subject: string, context: Record<string, unknown>): string {
    const compiled = this.templates.get(template);
    if (!compiled || !this.layout) throw new Error(`Mail template ${template} is not initialized`);
    const branding = this.config.getOrThrow('mail.branding', { infer: true });
    const body = compiled({ ...context, branding });
    return this.layout({ subject, body, branding });
  }
}
