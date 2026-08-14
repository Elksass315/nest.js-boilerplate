import { ConfigService } from '@nestjs/config';

import { createApplication } from './bootstrap';
import type { AppConfiguration } from './config/configuration.types';

async function bootstrap(): Promise<void> {
  const app = await createApplication();
  const configService = app.get(ConfigService<AppConfiguration, true>);

  await app.listen(configService.getOrThrow('app.port', { infer: true }), '0.0.0.0');
}

void bootstrap();
