import assert from 'node:assert/strict';
import test from 'node:test';

import { validateBranchName, validateWritableBranch } from './branch-policy.mjs';

test('accepts approved short-lived branch names for writes', () => {
  assert.equal(validateWritableBranch('feature/swagger-security'), undefined);
  assert.equal(validateWritableBranch('fix/readiness-timeout'), undefined);
});

test('rejects protected branches and detached HEAD for writes', () => {
  assert.match(validateWritableBranch('main'), /protected/);
  assert.match(validateWritableBranch('develop'), /protected/);
  assert.match(validateWritableBranch(''), /Detached HEAD/);
});

test('rejects invalid branch names', () => {
  assert.match(validateBranchName('feature/Invalid_Name'), /Invalid branch name/);
});
