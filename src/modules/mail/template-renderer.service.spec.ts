import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';

import { TemplateRendererService } from './template-renderer.service';

describe(TemplateRendererService.name, () => {
  it('wraps escaped email content in the shared branded header and footer', async () => {
    const branding = {
      primaryColor: '#4F46E5',
      secondaryColor: '#7C3AED',
      logoUrl: '',
      companyName: 'Example SaaS',
      supportEmail: 'support@example.com',
    };
    const module = await Test.createTestingModule({
      providers: [
        TemplateRendererService,
        { provide: ConfigService, useValue: { getOrThrow: (): typeof branding => branding } },
      ],
    }).compile();
    const renderer = module.get(TemplateRendererService);
    renderer.onModuleInit();

    const html = renderer.render('email-verification', 'Verify email', {
      name: '<script>alert(1)</script>',
      actionUrl: 'https://app.example.com/verify?token=example',
      expiresInMinutes: 60,
    });

    expect(html).toContain('Example SaaS');
    expect(html).toContain('support@example.com');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(html).not.toContain('<script>alert(1)</script>');
  });
});
