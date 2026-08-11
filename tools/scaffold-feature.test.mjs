import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const script = path.resolve('tools/scaffold-feature.mjs');

function run(args) {
  return spawnSync(process.execPath, [script, ...args], { encoding: 'utf8' });
}

test('prints a dry run without writing files', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'nestjs-scaffold-'));
  try {
    const result = run(['billing', '--http', '--dry-run', '--root', root]);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /billing\.controller\.ts/);
    assert.equal(existsSync(path.join(root, 'src')), false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('creates service-only and persistence-aware features', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'nestjs-scaffold-'));
  try {
    assert.equal(run(['reporting', '--root', root]).status, 0);
    assert.equal(existsSync(path.join(root, 'src/modules/reporting/reporting.service.ts')), true);

    assert.equal(run(['catalog', '--http', '--persistence', '--root', root]).status, 0);
    assert.equal(existsSync(path.join(root, 'src/modules/catalog/catalog.controller.ts')), true);
    const repository = readFileSync(
      path.join(root, 'src/modules/catalog/catalog.repository.ts'),
      'utf8',
    );
    assert.match(repository, /InjectRepository/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('rejects invalid names and refuses overwrites', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'nestjs-scaffold-'));
  try {
    assert.notEqual(run(['Invalid_Name', '--root', root]).status, 0);
    assert.equal(run(['billing', '--root', root]).status, 0);
    assert.notEqual(run(['billing', '--root', root]).status, 0);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
