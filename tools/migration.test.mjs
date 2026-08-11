import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import test from 'node:test';

const script = path.resolve('tools/migration.mjs');

function run(args, environment = {}) {
  return spawnSync(process.execPath, [script, ...args], {
    encoding: 'utf8',
    env: { ...process.env, ...environment },
  });
}

test('rejects invalid migration names before invoking TypeORM', () => {
  const result = run(['create', 'Invalid_Name']);

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Migration name must be lower-case kebab-case/);
});

test('restricts destructive migration validation to test databases', () => {
  const result = run(['validate'], { DATABASE_NAME: 'production' });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /database name ending in "_test"/);
});

test('prints usage for unsupported operations', () => {
  const result = run(['unknown']);

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Usage: node tools\/migration\.mjs/);
});
