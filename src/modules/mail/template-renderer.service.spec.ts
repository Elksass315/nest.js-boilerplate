import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';

import { TemplateRendererService } from './template-renderer.service';

describe(TemplateRendererService.name, () => {
  const branding = {
    primaryColor: '#4F46E5',
    secondaryColor: '#7C3AED',
    logoUrl: '',
    companyName: 'Example SaaS',
    supportEmail: 'support@example.com',
  };

  async function createRenderer(): Promise<TemplateRendererService> {
    const module = await Test.createTestingModule({
      providers: [
        TemplateRendererService,
        { provide: ConfigService, useValue: { getOrThrow: (): typeof branding => branding } },
      ],
    }).compile();
    const renderer = module.get(TemplateRendererService);
    renderer.onModuleInit();
    return renderer;
  }

  it('wraps escaped email content in the shared branded header and footer', async () => {
    const renderer = await createRenderer();

    const html = renderer.render('email-verification', 'Verify email', {
      name: '<script>alert(1)</script>',
      code: '482913',
      expiresInMinutes: 10,
    });

    expect(html).toContain('Example SaaS');
    expect(html).toContain('support@example.com');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('482913');
    expect(html).not.toContain('verify?token=');
    expect(html).not.toContain('actionUrl');
  });

  it('loads every security template through the shared layout', async () => {
    const renderer = await createRenderer();
    const templates = [
      'two-step-code',
      'new-session',
      'session-revoked',
      'password-changed',
      'two-step-changed',
      'account-status-changed',
      'role-changed',
      'team-invitation',
      'team-invitation-accepted',
    ] as const;

    for (const template of templates) {
      const html = renderer.render(template, 'Security notice', {
        name: 'Amina',
        code: '482913',
        expiresInMinutes: 5,
        occurredAt: '2026-08-12T12:00:00.000Z',
        enabled: true,
        status: 'active',
        roles: 'user',
        inviterName: 'Admin User',
        role: 'user',
        actionUrl: 'https://app.example.com/invitations/accept?token=example',
        expiresAt: '2026-08-21T12:00:00.000Z',
      });
      expect(html).toContain('<title>Security notice</title>');
      expect(html).toContain('Example SaaS');
      expect(html).toContain('support@example.com');
    }
  });
});
