import { NestFactory } from '@nestjs/core';

import { MaintenanceWorkerModule } from '@/apps/maintenance-worker/maintenance-worker.module';
import { MaintenanceWorkerService } from '@/apps/maintenance-worker/maintenance-worker.service';

async function main(): Promise<void> {
  const app = await NestFactory.createApplicationContext(MaintenanceWorkerModule, {
    logger: false,
  });
  try {
    const service = app.get(MaintenanceWorkerService);
    const result = await service.runOnce({ dryRun: process.argv.includes('--dry-run') });
    process.stdout.write(`${JSON.stringify(result)}\n`);
  } finally {
    await app.close();
  }
}

void main().catch(() => {
  process.exitCode = 1;
});
