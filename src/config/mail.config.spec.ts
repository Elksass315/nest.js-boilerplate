import { createMailConfig } from './mail.config';

describe('mail configuration', () => {
  it('maps SMTP, retry, and branding settings', () => {
    const config = createMailConfig({
      MAIL_ENABLED: true,
      MAIL_FROM_ADDRESS: 'noreply@example.com',
      MAIL_FROM_NAME: 'Example',
      MAIL_ACTION_BASE_URL: 'https://app.example.com',
      MAIL_SMTP_HOST: 'smtp.example.com',
      MAIL_SMTP_PORT: 587,
      MAIL_SMTP_SECURE: true,
      MAIL_SMTP_USERNAME: 'smtp-user',
      MAIL_SMTP_PASSWORD: 'smtp-password',
      MAIL_MAX_RETRIES: 3,
      MAIL_RETRY_DELAY_MS: 1000,
      MAIL_WORKER_CONCURRENCY: 5,
      MAIL_SMTP_CONNECTION_TIMEOUT_MS: 10000,
      MAIL_SMTP_SOCKET_TIMEOUT_MS: 30000,
      MAIL_BRANDING_PRIMARY_COLOR: '#112233',
      MAIL_BRANDING_SECONDARY_COLOR: '#445566',
      MAIL_BRANDING_LOGO_URL: 'https://app.example.com/logo.svg',
      MAIL_BRANDING_COMPANY_NAME: 'Example',
      MAIL_BRANDING_SUPPORT_EMAIL: 'support@example.com',
    });

    expect(config).toEqual({
      enabled: true,
      fromAddress: 'noreply@example.com',
      fromName: 'Example',
      actionBaseUrl: 'https://app.example.com',
      smtpHost: 'smtp.example.com',
      smtpPort: 587,
      smtpSecure: true,
      smtpUsername: 'smtp-user',
      smtpPassword: 'smtp-password',
      maxRetries: 3,
      retryDelayMs: 1000,
      workerConcurrency: 5,
      smtpConnectionTimeoutMs: 10000,
      smtpSocketTimeoutMs: 30000,
      branding: {
        primaryColor: '#112233',
        secondaryColor: '#445566',
        logoUrl: 'https://app.example.com/logo.svg',
        companyName: 'Example',
        supportEmail: 'support@example.com',
      },
    });
  });
});
