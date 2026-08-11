import { ConfigService } from '@nestjs/config';

import { createApplication } from './bootstrap';
import type { EnvironmentVariables } from './config/environment';

async function bootstrap(): Promise<void> {
  const app = await createApplication();
  const configService = app.get(ConfigService<EnvironmentVariables, true>);

  await app.listen(configService.getOrThrow('PORT', { infer: true }), '0.0.0.0');
}

void bootstrap();
