import '../../instrument';

import { ConfigService } from '@nestjs/config';
import { PinoLogger } from 'nestjs-pino';

import type { AppConfiguration } from '@/config/configuration.types';
import { captureStartupFailure } from '@/observability/sentry';

import { createApplication } from './bootstrap';

async function bootstrap(): Promise<void> {
  const app = await createApplication();
  const configService = app.get(ConfigService<AppConfiguration, true>);
  const logger = await app.resolve(PinoLogger);
  const port = configService.getOrThrow('app.port', { infer: true });

  await app.listen(port, '0.0.0.0');
  logger.info(
    {
      host: '0.0.0.0',
      port,
      health: {
        live: `http://localhost:${String(port)}/health/live`,
        ready: `http://localhost:${String(port)}/health/ready`,
      },
    },
    'API listening',
  );
}

void bootstrap().catch(async (error: unknown) => {
  await captureStartupFailure('api', error);
  process.stderr.write(
    `${JSON.stringify({
      level: 50,
      time: Date.now(),
      context: 'ApiBootstrap',
      ...startupFailureDetails(error),
      msg: 'API failed to start',
    })}\n`,
  );
  process.exitCode = 1;
});

function startupFailureDetails(error: unknown): Record<string, string | number> {
  if (!(error instanceof Error)) {
    return { errorType: 'UnknownError', errorMessage: String(error) };
  }

  const details: Record<string, string | number> = {
    errorType: error.name,
    errorMessage: error.message,
  };
  if (isRecord(error)) {
    addStringDetail(details, 'errorCode', error['code']);
    addStringDetail(details, 'syscall', error['syscall']);
    addStringDetail(details, 'address', error['address']);
    addNumberDetail(details, 'port', error['port']);
    if (error['code'] === 'EADDRINUSE') {
      details['reason'] = 'The configured port is already in use';
      details['resolution'] = 'Stop the process using the port or configure a different PORT value';
    }
  }
  return details;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function addStringDetail(
  details: Record<string, string | number>,
  key: string,
  value: unknown,
): void {
  if (typeof value === 'string') details[key] = value;
}

function addNumberDetail(
  details: Record<string, string | number>,
  key: string,
  value: unknown,
): void {
  if (typeof value === 'number') details[key] = value;
}
