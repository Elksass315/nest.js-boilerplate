import type { INestApplication } from '@nestjs/common';
import request from 'supertest';

import { createApplication } from '../src/bootstrap';

jest.setTimeout(30_000);

describe('platform foundation (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
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
});
