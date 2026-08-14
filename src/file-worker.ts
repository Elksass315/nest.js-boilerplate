import { NestFactory } from '@nestjs/core';

import { FileWorkerModule } from './file-worker.module';

async function bootstrap(): Promise<void> {
  const context = await NestFactory.createApplicationContext(FileWorkerModule, {
    bufferLogs: true,
  });
  context.enableShutdownHooks(['SIGINT', 'SIGTERM']);
}

void bootstrap().catch(() => {
  process.stderr.write('File worker failed to start\n');
  process.exitCode = 1;
});
