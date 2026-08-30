import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { checkCapabilityBoundaries } from './check-capabilities.mjs';

test('optional capability boundaries and manifest validation pass', () => {
  assert.doesNotThrow(() => checkCapabilityBoundaries());
});

test('rejects manifest paths that do not exist', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'capability-paths-'));
  try {
    writeFileSync(
      path.join(root, 'capabilities.manifest.json'),
      JSON.stringify({
        mandatory: ['core'],
        capabilities: {
          core: {
            dependencies: [],
            sourcePaths: ['src/missing'],
            migrationPaths: [],
            seedPaths: [],
            configurationPaths: [],
            environmentKeys: [],
            workerProcesses: [],
            composeServices: [],
            documentation: [],
            packageDependencies: [],
          },
        },
      }),
    );

    assert.throws(
      () => checkCapabilityBoundaries(root),
      /Capability core references missing sourcePaths path: src\/missing/,
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
