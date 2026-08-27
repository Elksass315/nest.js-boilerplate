import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

import { ConfigService } from '@nestjs/config';

import { createApplication } from '@/apps/api/bootstrap';
import { createOpenApiDocument } from '@/common/swagger/configure-swagger';
import type { AppConfiguration } from '@/config/configuration.types';

async function generateOpenApi(): Promise<void> {
  const outputPath = path.resolve(process.argv[2] ?? '.tmp/openapi.json');
  const app = await createApplication({ configureDocumentation: false });

  try {
    await app.init();
    const config = app.get(ConfigService<AppConfiguration, true>);
    const document = createOpenApiDocument(app, config.getOrThrow('app.name', { infer: true }));
    await mkdir(path.dirname(outputPath), { recursive: true });
    await writeFile(outputPath, `${JSON.stringify(document, null, 2)}\n`, 'utf8');
    process.stdout.write(`OpenAPI document generated at ${outputPath}\n`);
  } finally {
    await app.close();
  }
}

void generateOpenApi().catch((error: unknown) => {
  process.stderr.write(
    `OpenAPI generation failed (${error instanceof Error ? error.name : 'UnknownError'})\n`,
  );
  process.exitCode = 1;
});
