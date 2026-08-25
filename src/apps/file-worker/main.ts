import '../../instrument';

import { NestFactory } from '@nestjs/core';

import { captureStartupFailure } from '@/observability/sentry';

import { FileWorkerModule } from './file-worker.module';

async function bootstrap(): Promise<void> {
  const context = await NestFactory.createApplicationContext(FileWorkerModule, {
    bufferLogs: true,
  });
  context.enableShutdownHooks(['SIGINT', 'SIGTERM']);
}

void bootstrap().catch(async (error: unknown) => {
  await captureStartupFailure('file-worker', error);
  process.stderr.write('File worker failed to start\n');
  process.exitCode = 1;
});
