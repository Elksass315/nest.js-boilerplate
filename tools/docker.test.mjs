import assert from 'node:assert/strict';
import test from 'node:test';

import { buildComposeArguments } from './docker-lib.mjs';

test('builds a development Compose up command', () => {
  const args = buildComposeArguments('up');

  assert.equal(args[0], 'compose');
  assert.ok(args.includes('--build'));
  assert.ok(args.includes('--wait'));
  assert.ok(args.some((value) => value.endsWith('compose.dev.yaml')));
});

test('builds a destructive reset only as a down command', () => {
  const args = buildComposeArguments('reset');

  assert.ok(args.includes('down'));
  assert.ok(args.includes('--volumes'));
});

test('rejects unknown commands', () => {
  assert.throws(() => buildComposeArguments('destroy'), /Unknown Docker command/);
});
