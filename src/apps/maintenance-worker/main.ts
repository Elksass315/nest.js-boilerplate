import '../../instrument';

import { NestFactory } from '@nestjs/core';

import { MaintenanceWorkerModule } from './maintenance-worker.module';

async function bootstrap(): Promise<void> {
  const context = await NestFactory.createApplicationContext(MaintenanceWorkerModule, {
    bufferLogs: true,
  });
  context.enableShutdownHooks(['SIGINT', 'SIGTERM']);
}

void bootstrap().catch(() => {
  process.stderr.write('Maintenance worker failed to start\n');
  process.exitCode = 1;
});
