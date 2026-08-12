import type { INestApplication } from '@nestjs/common';
import request from 'supertest';

import { createApplication } from '../src/bootstrap';
import { AuthService } from '../src/modules/auth';

jest.setTimeout(30_000);

describe('platform foundation (e2e)', () => {
  let app: INestApplication;
  const originalSwaggerAccess = process.env['SWAGGER_DOCS_ACCESS'];
  const originalAuthSecret = process.env['AUTH_ACCESS_TOKEN_SECRET'];
  const originalMailEnabled = process.env['MAIL_ENABLED'];

  beforeAll(async () => {
    process.env['SWAGGER_DOCS_ACCESS'] = 'public';
    process.env['AUTH_ACCESS_TOKEN_SECRET'] = 'e2e-only-access-token-secret-at-least-32-characters';
    process.env['MAIL_ENABLED'] = 'false';
    app = await createApplication();
    await app.init();
  });

  afterAll(async () => {
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
    expect(document.paths).toHaveProperty('/api/v1/sessions');
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

  it('registers, verifies, logs in, lists sessions, rotates refresh, and detects reuse', async () => {
    const email = 'identity-e2e@example.com';
    const password = 'Correct-Horse-Battery-2026!';
    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .set('x-correlation-id', 'e2e-auth-register')
      .send({ fullName: 'Identity E2E', email, password })
      .expect('x-correlation-id', 'e2e-auth-register')
      .expect(201);

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
  });
});
