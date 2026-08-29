import '../../instrument';

import { NestFactory } from '@nestjs/core';

import { captureStartupFailure } from '@/core/error-reporting/error-reporter';

import { MailWorkerModule } from './mail-worker.module';

async function bootstrap(): Promise<void> {
  const context = await NestFactory.createApplicationContext(MailWorkerModule, {
    bufferLogs: true,
  });
  context.enableShutdownHooks(['SIGINT', 'SIGTERM']);
}

void bootstrap().catch(async (error: unknown) => {
  await captureStartupFailure('mail-worker', error);
  process.stderr.write('Mail worker failed to start\n');
  process.exitCode = 1;
});
