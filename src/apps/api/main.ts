import '../../instrument';

import { ConfigService } from '@nestjs/config';

import type { AppConfiguration } from '@/config/configuration.types';
import { captureStartupFailure } from '@/observability/sentry';

import { createApplication } from './bootstrap';

async function bootstrap(): Promise<void> {
  const app = await createApplication();
  const configService = app.get(ConfigService<AppConfiguration, true>);

  await app.listen(configService.getOrThrow('app.port', { infer: true }), '0.0.0.0');
}

void bootstrap().catch(async (error: unknown) => {
  await captureStartupFailure('api', error);
  process.stderr.write('API failed to start\n');
  process.exitCode = 1;
});
