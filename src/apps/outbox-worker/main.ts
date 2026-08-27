import '../../instrument';

import { NestFactory } from '@nestjs/core';

import { OutboxWorkerModule } from './outbox-worker.module';

async function bootstrap(): Promise<void> {
  const context = await NestFactory.createApplicationContext(OutboxWorkerModule, {
    bufferLogs: true,
  });
  context.enableShutdownHooks(['SIGINT', 'SIGTERM']);
}

void bootstrap().catch(() => {
  process.stderr.write('Outbox worker failed to start\n');
  process.exitCode = 1;
});
