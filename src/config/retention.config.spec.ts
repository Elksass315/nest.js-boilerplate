import { createRetentionConfig, retentionEnvironmentSchema } from './retention.config';

describe('retention configuration', () => {
  it('provides bounded operational defaults', () => {
    const result = retentionEnvironmentSchema.RETENTION_BATCH_SIZE.validate(undefined);
    expect(result.value).toBe(100);
    expect(
      createRetentionConfig({
        RETENTION_ENABLED: true,
        RETENTION_INTERVAL_MS: 60_000,
        RETENTION_BATCH_SIZE: 10,
        RETENTION_AUTH_TOKEN_DAYS: 1,
        RETENTION_SESSION_DAYS: 2,
        RETENTION_MAIL_DAYS: 3,
        RETENTION_OUTBOX_DAYS: 4,
        RETENTION_OUTBOX_FAILURE_DAYS: 5,
      }),
    ).toEqual({
      enabled: true,
      intervalMs: 60_000,
      batchSize: 10,
      authTokenDays: 1,
      sessionDays: 2,
      mailDays: 3,
      outboxDays: 4,
      outboxFailureDays: 5,
    });
  });
});
