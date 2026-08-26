import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { spawnSync } from 'node:child_process';

const operation = process.argv[2];
const name = process.argv[3];
const migrationsDirectory = path.resolve('src/database/migrations');
const pnpm = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';

function runTypeOrm(args) {
  const executable = pnpm;
  const invocation = [
    'exec',
    'typeorm-ts-node-commonjs',
    ...args,
    '-d',
    'src/database/data-source.ts',
  ];
  const result = spawnSync(executable, invocation, {
    stdio: 'inherit',
    env: {
      ...process.env,
      NODE_OPTIONS: [process.env.NODE_OPTIONS, '--require tsconfig-paths/register']
        .filter(Boolean)
        .join(' '),
    },
    shell: process.platform === 'win32',
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

function validatedName() {
  if (!name || !/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(name)) {
    throw new Error('Migration name must be lower-case kebab-case, for example "create-users"');
  }
  if (
    existsSync(migrationsDirectory) &&
    readdirSync(migrationsDirectory).some((file) => file.endsWith(`-${name}.ts`))
  ) {
    throw new Error(`Migration already exists for name "${name}"`);
  }
  return path.join('src/database/migrations', name);
}

switch (operation) {
  case 'create':
    runTypeOrm(['migration:create', validatedName()]);
    break;
  case 'generate':
    runTypeOrm(['migration:generate', validatedName()]);
    break;
  case 'run':
    runTypeOrm(['migration:run']);
    break;
  case 'revert':
    runTypeOrm(['migration:revert']);
    break;
  case 'show':
    runTypeOrm(['migration:show']);
    break;
  case 'validate': {
    const databaseName = process.env.DATABASE_NAME ?? '';
    if (!databaseName.endsWith('_test')) {
      throw new Error('Migration validation is restricted to a database name ending in "_test"');
    }
    runTypeOrm(['migration:run']);
    runTypeOrm(['migration:revert']);
    runTypeOrm(['migration:run']);
    break;
  }
  default:
    throw new Error(
      'Usage: node tools/migration.mjs <create|generate|run|revert|show|validate> [name]',
    );
}
