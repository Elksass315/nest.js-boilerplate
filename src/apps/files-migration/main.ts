import { NestFactory } from '@nestjs/core';

import { FilesMigrationService } from '@/modules/files';
import { parseFileMigrationOptions } from '@/modules/files/files-migration-options';

import { FilesCliModule } from './files-cli.module';

async function main(): Promise<void> {
  const context = await NestFactory.createApplicationContext(FilesCliModule, { logger: false });
  try {
    const service = context.get(FilesMigrationService);
    const command = process.argv[2];
    if (command !== 'status' && command !== 'migrate') {
      throw new Error('Usage: files-migration <status|migrate> [options]');
    }
    if (command === 'status' && process.argv.length > 3) {
      throw new Error('The status command does not accept arguments');
    }
    const result =
      command === 'status'
        ? await service.status()
        : await service.migrate(parseFileMigrationOptions(process.argv.slice(3)));
    process.stdout.write(`${JSON.stringify(result)}\n`);
  } finally {
    await context.close();
  }
}

void main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : 'File migration failed'}\n`);
  process.exitCode = 1;
});
