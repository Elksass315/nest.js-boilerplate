import assert from 'node:assert/strict';
import test from 'node:test';

import { validateBranchName, validateWritableBranch } from './branch-policy.mjs';

test('accepts approved short-lived branch names for writes', () => {
  assert.equal(validateWritableBranch('feature/swagger-security'), undefined);
  assert.equal(validateWritableBranch('fix/readiness-timeout'), undefined);
  assert.equal(validateWritableBranch('release/0.1.0'), undefined);
  assert.equal(validateWritableBranch('release/1.2.3-rc.1'), undefined);
});

test('rejects protected branches and detached HEAD for writes', () => {
  assert.match(validateWritableBranch('main'), /protected/);
  assert.match(validateWritableBranch('develop'), /protected/);
  assert.match(validateWritableBranch(''), /Detached HEAD/);
});

test('rejects invalid branch names', () => {
  assert.match(validateBranchName('feature/Invalid_Name'), /Invalid branch name/);
  assert.match(validateBranchName('release/01.2.3'), /Invalid branch name/);
  assert.match(validateBranchName('release/not-semver'), /Invalid branch name/);
});
