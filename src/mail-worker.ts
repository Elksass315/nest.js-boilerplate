import { NestFactory } from '@nestjs/core';

import { MailWorkerModule } from './mail-worker.module';

async function bootstrap(): Promise<void> {
  const context = await NestFactory.createApplicationContext(MailWorkerModule, {
    bufferLogs: true,
  });
  context.enableShutdownHooks(['SIGINT', 'SIGTERM']);
}

void bootstrap().catch(() => {
  process.stderr.write('Mail worker failed to start\n');
  process.exitCode = 1;
});
