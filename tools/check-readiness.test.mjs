import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';
import { checkReadiness } from './check-readiness.mjs';

test('readiness contract passes for the repository', () => {
  assert.deepEqual(checkReadiness(), []);
});

test('readiness contract reports missing governance files', () => {
  const root = mkdtempSync(path.join(os.tmpdir(), 'boilerplate-readiness-'));
  mkdirSync(path.join(root, 'deployment'), { recursive: true });
  writeFileSync(
    path.join(root, 'capabilities.manifest.json'),
    JSON.stringify({ mandatory: [], capabilities: {} }),
  );
  writeFileSync(path.join(root, 'deployment/migration-compatibility.json'), '{}');
  writeFileSync(path.join(root, 'package.json'), JSON.stringify({ scripts: {} }));
  writeFileSync(path.join(root, 'Jenkinsfile'), 'pipeline {}');
  const violations = checkReadiness(root);
  assert.ok(violations.some((violation) => violation.startsWith('missing docs/')));
  assert.ok(violations.includes('migration compatibility must declare expand-contract-v1'));
});
