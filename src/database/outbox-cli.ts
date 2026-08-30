import { DataSource } from 'typeorm';

import { loadDatabaseConfiguration } from '@/config/environment';

const id = process.argv[3];
const operation = process.argv[2];

async function run(): Promise<void> {
  if (operation !== 'status' && operation !== 'retry') {
    throw new Error('Usage: outbox-cli <status|retry> <message-id>');
  }
  if (!id || !isUuid(id)) throw new Error('An explicit outbox message UUID is required');
  const dataSource = new DataSource({
    type: 'postgres',
    ...loadDatabaseConfiguration(),
    synchronize: false,
    migrationsRun: false,
  });
  await dataSource.initialize();
  try {
    if (operation === 'status') {
      const rows = await dataSource.query<Record<string, unknown>[]>(
        'SELECT id, topic, status, attempts, available_at, last_error_code, correlation_id FROM outbox_messages WHERE id = $1',
        [id],
      );
      process.stdout.write(`${JSON.stringify(rows[0] ?? null)}\n`);
      return;
    }
    const result = await dataSource.query<Record<string, unknown>[]>(
      `UPDATE outbox_messages SET status = 'pending', available_at = now(), lease_until = NULL,
       lease_token = NULL, last_error_code = NULL, updated_at = now()
       WHERE id = $1 AND status IN ('failed', 'processing') RETURNING id, status, correlation_id`,
      [id],
    );
    process.stdout.write(`${JSON.stringify(result[0] ?? null)}\n`);
  } finally {
    await dataSource.destroy();
  }
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

void run().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : 'Outbox command failed'}\n`);
  process.exitCode = 1;
});
