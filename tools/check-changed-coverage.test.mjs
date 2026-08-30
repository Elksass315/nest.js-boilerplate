import assert from 'node:assert/strict';
import path from 'node:path';
import { describe, it } from 'node:test';

import { calculateChangedCoverage, parseChangedLines } from './check-changed-coverage.mjs';

describe('changed coverage gate', () => {
  it('extracts added and modified lines from zero-context git diffs', () => {
    const changed = parseChangedLines(`+++ b/src/example.ts
@@ -2 +2,2 @@
+first
+second
`);

    assert.deepEqual([...(changed.get(path.join('src', 'example.ts')) ?? [])], [2, 3]);
  });

  it('measures only executable changed lines from Istanbul coverage', () => {
    const fileName = path.join('src', 'example.ts');
    const absolutePath = path.resolve(fileName);
    const result = calculateChangedCoverage({
      coverage: {
        [absolutePath]: {
          statementMap: {
            0: { start: { line: 2, column: 0 }, end: { line: 2, column: 10 } },
            1: { start: { line: 4, column: 0 }, end: { line: 4, column: 10 } },
          },
          s: { 0: 1, 1: 0 },
        },
      },
      changedLines: new Map([[fileName, new Set([2, 3, 4])]]),
    });

    assert.equal(result.coverable, 2);
    assert.equal(result.covered, 1);
    assert.equal(result.percentage, 50);
    assert.deepEqual(result.uncovered, [`${fileName}:4`]);
  });
});
