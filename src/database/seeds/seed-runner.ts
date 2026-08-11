import { NestFactory } from '@nestjs/core';

import { SeedModule } from './seed.module';
import { SeedRunnerService } from './seed-runner.service';

async function main(): Promise<void> {
  const command = process.argv[2] ?? 'run';
  if (command !== 'run' && command !== 'show') {
    throw new Error('Seed command must be "run" or "show"');
  }

  const app = await NestFactory.createApplicationContext(SeedModule, {
    logger: ['error', 'warn', 'log'],
  });
  try {
    const runner = app.get(SeedRunnerService);
    const statuses = command === 'show' ? await runner.show() : await runner.run();
    for (const status of statuses) {
      process.stdout.write(`${status.status.padEnd(7)} ${status.id} - ${status.description}\n`);
    }
  } finally {
    await app.close();
  }
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'Unknown seed failure';
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
