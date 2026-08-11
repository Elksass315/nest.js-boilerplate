import path from 'node:path';

export function buildComposeArguments(command, extraArguments = []) {
  const files = ['-f', path.resolve('compose.yaml'), '-f', path.resolve('compose.dev.yaml')];
  const base = ['compose', '--env-file', path.resolve('.env'), ...files];

  switch (command) {
    case 'up':
      return [...base, 'up', '--build', '--detach', '--wait', ...extraArguments];
    case 'down':
      return [...base, 'down', '--remove-orphans', ...extraArguments];
    case 'restart':
      return [...base, 'restart', ...extraArguments];
    case 'logs':
      return [...base, 'logs', '--follow', '--tail', '200', ...extraArguments];
    case 'ps':
      return [...base, 'ps', ...extraArguments];
    case 'config':
      return [...base, 'config', '--quiet', ...extraArguments];
    case 'reset':
      return [...base, 'down', '--volumes', '--remove-orphans', ...extraArguments];
    default:
      throw new Error(`Unknown Docker command: ${command}`);
  }
}
