import { spawnSync } from 'node:child_process';
import process from 'node:process';

import { buildComposeArguments } from './docker-lib.mjs';

const [command, ...extraArguments] = process.argv.slice(2);

try {
  if (!command) {
    throw new Error('Usage: node tools/docker.mjs <up|down|restart|logs|ps|config|reset>');
  }
  if (command === 'reset') {
    const confirmationIndex = extraArguments.indexOf('--confirm');
    if (confirmationIndex < 0) {
      throw new Error('docker:reset deletes local volumes; repeat with -- --confirm');
    }
    extraArguments.splice(confirmationIndex, 1);
  }

  const result = spawnSync('docker', buildComposeArguments(command, extraArguments), {
    stdio: 'inherit',
  });

  if (result.error) {
    throw result.error;
  }
  process.exitCode = result.status ?? 1;
} catch (error) {
  const message = error instanceof Error ? error.message : 'Unknown Docker command error';
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
}
