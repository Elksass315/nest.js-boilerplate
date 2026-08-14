import type { INestApplication, INestApplicationContext } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import sharp from 'sharp';
import request from 'supertest';
import { DataSource } from 'typeorm';

import { createApplication } from '../src/bootstrap';
import { AuthService } from '../src/modules/auth';
import { MailWorkerModule } from '../src/mail-worker.module';

jest.setTimeout(30_000);

describe('platform foundation (e2e)', () => {
  let app: INestApplication;
  let mailWorker: INestApplicationContext;
  const originalSwaggerAccess = process.env['SWAGGER_DOCS_ACCESS'];
  const originalAuthSecret = process.env['AUTH_ACCESS_TOKEN_SECRET'];
  const originalMailEnabled = process.env['MAIL_ENABLED'];

  beforeAll(async () => {
    process.env['SWAGGER_DOCS_ACCESS'] = 'public';
    process.env['AUTH_ACCESS_TOKEN_SECRET'] = 'e2e-only-access-token-secret-at-least-32-characters';
    process.env['MAIL_ENABLED'] = 'true';
    process.env['MAIL_SMTP_HOST'] = process.env['MAIL_SMTP_HOST'] ?? 'localhost';
    process.env['MAIL_SMTP_PORT'] = process.env['MAIL_SMTP_PORT'] ?? '1025';
    app = await createApplication();
    await app.init();
    mailWorker = await NestFactory.createApplicationContext(MailWorkerModule, { logger: false });
    await fetch('http://127.0.0.1:8025/api/v1/messages', { method: 'DELETE' });
  });

  afterAll(async () => {
    await mailWorker.close();
    await app.close();
    if (originalSwaggerAccess === undefined) {
      delete process.env['SWAGGER_DOCS_ACCESS'];
    } else {
      process.env['SWAGGER_DOCS_ACCESS'] = originalSwaggerAccess;
    }
    if (originalAuthSecret === undefined) delete process.env['AUTH_ACCESS_TOKEN_SECRET'];
    else process.env['AUTH_ACCESS_TOKEN_SECRET'] = originalAuthSecret;
    if (originalMailEnabled === undefined) delete process.env['MAIL_ENABLED'];
    else process.env['MAIL_ENABLED'] = originalMailEnabled;
  });

  it('serves liveness outside the API version prefix', async () => {
    const response = await request(app.getHttpServer()).get('/health/live').expect(200);

    expect(response.body).toEqual(
      expect.objectContaining({
        status: 'ok',
        timestamp: expect.any(String),
        uptimeSeconds: expect.any(Number),
      }),
    );
    expect(response.headers).toHaveProperty('x-request-id');
    expect(response.headers).toHaveProperty('x-correlation-id', response.headers['x-request-id']);
    expect(response.headers).toHaveProperty('content-language', 'en');
    expect(response.headers).toHaveProperty('x-content-type-options', 'nosniff');
  });

  it('reports PostgreSQL and Redis readiness', async () => {
    await request(app.getHttpServer())
      .get('/health/ready')
      .expect(200)
      .expect(({ body }) => {
        expect(body).toEqual(
          expect.objectContaining({
            status: 'ok',
            checks: { database: 'up', redis: 'up' },
          }),
        );
      });
  });

  it('preserves a safe request ID', async () => {
    await request(app.getHttpServer())
      .get('/health/live')
      .set('x-request-id', 'e2e-request-1')
      .expect('x-request-id', 'e2e-request-1')
      .expect(200);
  });

  it('propagates a supplied correlation ID independently across the request', async () => {
    await request(app.getHttpServer())
      .get('/health/live')
      .set('x-request-id', 'e2e-request-2')
      .set('x-correlation-id', 'e2e-workflow-1')
      .expect('x-request-id', 'e2e-request-2')
      .expect('x-correlation-id', 'e2e-workflow-1')
      .expect(200);
  });

  it('includes request and correlation IDs in safe error responses', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/missing')
      .set('x-correlation-id', 'e2e-workflow-error')
      .expect('content-language', 'en')
      .expect(404);

    expect(response.body).toEqual(
      expect.objectContaining({
        statusCode: 404,
        code: 'RESOURCE_NOT_FOUND',
        requestId: expect.any(String),
        correlationId: 'e2e-workflow-error',
      }),
    );
  });

  it.each(['/api/v1/users', '/api/v1/authorization/roles'])(
    'protects the identity endpoint %s and preserves correlation context',
    async (route) => {
      const response = await request(app.getHttpServer())
        .get(route)
        .set('x-correlation-id', 'e2e-identity-workflow')
        .expect('content-language', 'en')
        .expect(401);

      expect(response.body).toEqual(
        expect.objectContaining({
          statusCode: 401,
          code: 'UNAUTHORIZED',
          message: 'Authentication is required',
          requestId: expect.any(String),
          correlationId: 'e2e-identity-workflow',
        }),
      );
    },
  );

  it('publishes versioned identity contracts with distinct role-update failures', async () => {
    const response = await request(app.getHttpServer()).get('/docs-json').expect(200);
    const document = response.body as {
      paths?: Record<
        string,
        { put?: { responses?: Record<string, { content?: Record<string, unknown> }> } }
      >;
    };

    expect(document.paths).toHaveProperty('/api/v1/users');
    expect(document.paths).toHaveProperty('/api/v1/authorization/roles');
    expect(document.paths).toHaveProperty('/api/v1/auth/register');
    expect(document.paths).toHaveProperty('/api/v1/auth/refresh');
    expect(document.paths).toHaveProperty('/api/v1/auth/login/two-step');
    expect(document.paths).toHaveProperty('/api/v1/auth/two-step/enable/confirm');
    expect(document.paths).toHaveProperty('/api/v1/sessions');
    expect(document.paths).toHaveProperty('/api/v1/users/me/avatar/uploads');
    expect(document.paths).toHaveProperty('/api/v1/users/me/avatar/uploads/{uploadId}');
    expect(document.paths).toHaveProperty('/api/v1/users/me/avatar');
    expect(document.paths?.['/api/v1/users/{id}/roles']?.put?.responses?.['404']?.content).toEqual(
      expect.objectContaining({
        'application/json': expect.objectContaining({
          examples: expect.objectContaining({
            userNotFound: expect.any(Object),
            roleNotFound: expect.any(Object),
          }),
        }),
      }),
    );
  });

  it('resumes, sanitizes, publishes, and removes an authenticated user avatar', async () => {
    const email = `avatar-e2e-${String(Date.now())}@example.com`;
    const password = 'Correct-Horse-Battery-2026!';
    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ fullName: 'Avatar E2E', email, password })
      .expect(201);
    const verification = await app.get(AuthService).resendVerification(email);
    if (!verification) throw new Error('Expected avatar-user verification delivery');
    await request(app.getHttpServer())
      .post('/api/v1/auth/verification/confirm')
      .send({ token: verification.token })
      .expect(200);
    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password })
      .expect(200);
    const authorization = `Bearer ${String(login.body.accessToken)}`;
    const avatar = await sharp({
      create: { width: 32, height: 32, channels: 3, background: '#2366aa' },
    })
      .withMetadata({ comment: 'must not survive sanitization' })
      .png()
      .toBuffer();

    await request(app.getHttpServer())
      .post('/api/v1/users/me/avatar/uploads')
      .set('Tus-Resumable', '1.0.0')
      .set('Upload-Length', String(avatar.byteLength))
      .set(
        'Upload-Metadata',
        `filename ${Buffer.from('avatar.png').toString('base64')},filetype ${Buffer.from('image/png').toString('base64')}`,
      )
      .expect(401);

    await request(app.getHttpServer())
      .options('/api/v1/users/me/avatar/uploads')
      .expect('Tus-Resumable', '1.0.0')
      .expect(204);

    const creation = await request(app.getHttpServer())
      .post('/api/v1/users/me/avatar/uploads')
      .set('authorization', authorization)
      .set('x-correlation-id', 'e2e-avatar-upload')
      .set('Tus-Resumable', '1.0.0')
      .set('Upload-Length', String(avatar.byteLength))
      .set(
        'Upload-Metadata',
        `filename ${Buffer.from('avatar.png').toString('base64')},filetype ${Buffer.from('image/png').toString('base64')}`,
      )
      .expect('x-correlation-id', 'e2e-avatar-upload')
      .expect(201);
    const location = String(creation.headers['location']);
    expect(location).toMatch(/^\/api\/v1\/users\/me\/avatar\/uploads\/[0-9a-f-]{36}$/i);
    const fileId = location.slice(location.lastIndexOf('/') + 1);

    await request(app.getHttpServer())
      .head(location)
      .set('authorization', authorization)
      .set('Tus-Resumable', '1.0.0')
      .expect('Upload-Offset', '0')
      .expect(200);
    await request(app.getHttpServer())
      .patch(location)
      .set('authorization', authorization)
      .set('Tus-Resumable', '1.0.0')
      .set('Upload-Offset', '0')
      .set('Content-Type', 'application/offset+octet-stream')
      .send(avatar)
      .expect('Upload-Offset', String(avatar.byteLength))
      .expect(204);

    const attached = await request(app.getHttpServer())
      .patch('/api/v1/users/me/avatar')
      .set('authorization', authorization)
      .set('x-correlation-id', 'e2e-avatar-claim')
      .send({ fileId })
      .expect('x-correlation-id', 'e2e-avatar-claim')
      .expect(200);
    expect(attached.body.avatar).toEqual(
      expect.objectContaining({ fileId, mimeType: 'image/png', url: expect.any(String) }),
    );
    await request(app.getHttpServer())
      .get(String(attached.body.avatar.url))
      .expect('content-type', /image\/png/)
      .expect(200);

    await request(app.getHttpServer())
      .delete('/api/v1/users/me/avatar')
      .set('authorization', authorization)
      .expect(204);
    await request(app.getHttpServer())
      .delete('/api/v1/users/me/avatar')
      .set('authorization', authorization)
      .expect(204);
  });

  it('registers, verifies, logs in, lists sessions, rotates refresh, and detects reuse', async () => {
    const email = `identity-e2e-${String(Date.now())}@example.com`;
    const password = 'Correct-Horse-Battery-2026!';
    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .set('x-correlation-id', 'e2e-auth-register')
      .send({ fullName: 'Identity E2E', email, password })
      .expect('x-correlation-id', 'e2e-auth-register')
      .expect(201);

    await waitForMailSubject('Verify your email address');
    await expect(waitForSentDelivery(app.get(DataSource), 'email-verification')).resolves.toEqual({
      status: 'sent',
      correlation_id: 'e2e-auth-register',
    });

    const delivery = await app.get(AuthService).resendVerification(email);
    expect(delivery).not.toBeNull();
    if (!delivery) throw new Error('Expected verification delivery');
    await request(app.getHttpServer())
      .post('/api/v1/auth/verification/confirm')
      .send({ token: delivery.token })
      .expect(200);

    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password })
      .expect(200);
    expect(login.body).toEqual(
      expect.objectContaining({
        accessToken: expect.any(String),
        refreshToken: expect.any(String),
        tokenType: 'Bearer',
        expiresIn: 900,
      }),
    );

    await request(app.getHttpServer())
      .get('/api/v1/sessions?page=1&limit=20')
      .set('authorization', `Bearer ${String(login.body.accessToken)}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body).toEqual(
          expect.objectContaining({ items: expect.any(Array), meta: expect.any(Object) }),
        );
      });

    await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: login.body.refreshToken })
      .expect(200);
    const reuse = await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .set('x-correlation-id', 'e2e-refresh-reuse')
      .send({ refreshToken: login.body.refreshToken })
      .expect(401);
    expect(reuse.body).toEqual(
      expect.objectContaining({
        code: 'REFRESH_TOKEN_REUSED',
        correlationId: 'e2e-refresh-reuse',
      }),
    );

    const enrollmentLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password })
      .expect(200);
    const enrollment = await request(app.getHttpServer())
      .post('/api/v1/auth/two-step/enable/request')
      .set('authorization', `Bearer ${String(enrollmentLogin.body.accessToken)}`)
      .set('x-correlation-id', 'e2e-two-step-enrollment')
      .send({ currentPassword: password })
      .expect(200);
    const enrollmentMail = await waitForMailSubject('Your security code');
    const enrollmentCode = extractEmailCode(enrollmentMail.HTML);
    const enabled = await request(app.getHttpServer())
      .post('/api/v1/auth/two-step/enable/confirm')
      .set('authorization', `Bearer ${String(enrollmentLogin.body.accessToken)}`)
      .send({ challengeToken: enrollment.body.challengeToken, code: enrollmentCode })
      .expect(200);
    expect(enabled.body.recoveryCodes).toHaveLength(10);

    const protectedLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password })
      .expect(200);
    expect(protectedLogin.body).toEqual(
      expect.objectContaining({ requiresTwoStep: true, challengeToken: expect.any(String) }),
    );
    const recoveryCode = String(enabled.body.recoveryCodes[0]);
    await request(app.getHttpServer())
      .post('/api/v1/auth/login/two-step')
      .send({
        method: 'recovery_code',
        challengeToken: protectedLogin.body.challengeToken,
        recoveryCode,
      })
      .expect(200)
      .expect(({ body }) => {
        expect(body).toEqual(expect.objectContaining({ accessToken: expect.any(String) }));
      });

    const secondProtectedLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password })
      .expect(200);
    await request(app.getHttpServer())
      .post('/api/v1/auth/login/two-step')
      .send({
        method: 'recovery_code',
        challengeToken: secondProtectedLogin.body.challengeToken,
        recoveryCode,
      })
      .expect(401)
      .expect(({ body }) => {
        expect(body).toEqual(expect.objectContaining({ code: 'INVALID_RECOVERY_CODE' }));
      });
  });
});

interface MailpitMessage {
  ID: string;
  Subject: string;
}

interface MailpitMessageDetails extends MailpitMessage {
  HTML: string;
}

async function waitForMailSubject(subject: string): Promise<MailpitMessageDetails> {
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    const response = await fetch('http://127.0.0.1:8025/api/v1/messages');
    if (response.ok) {
      const result = (await response.json()) as { messages?: MailpitMessage[] };
      const message = result.messages?.find((candidate) => candidate.Subject === subject);
      if (message) {
        const details = await fetch(`http://127.0.0.1:8025/api/v1/message/${message.ID}`);
        if (details.ok) return (await details.json()) as MailpitMessageDetails;
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error(`Mailpit did not receive expected subject: ${subject}`);
}

function extractEmailCode(html: string): string {
  const code = /\b\d{6}\b/.exec(html)?.[0];
  if (!code) throw new Error('Expected a six-digit code in the Mailpit message');
  return code;
}

async function waitForSentDelivery(
  dataSource: DataSource,
  template: string,
): Promise<{ status: string; correlation_id: string | null }> {
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    const rows: { status: string; correlation_id: string | null }[] = await dataSource.query(
      'SELECT status, correlation_id FROM mail_deliveries WHERE template = $1 ORDER BY created_at DESC LIMIT 1',
      [template],
    );
    if (rows[0]?.status === 'sent') return rows[0];
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Mail delivery did not reach sent status: ${template}`);
}
