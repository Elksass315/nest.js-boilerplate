import assert from 'node:assert/strict';
import test from 'node:test';

import { buildChangeValidationPlan, normalizeChangedFiles } from './validate-change-lib.mjs';

test('normalizes and deduplicates changed paths', () => {
  assert.deepEqual(normalizeChangedFiles(['src\\modules\\users.ts', '', 'src/modules/users.ts']), [
    'src/modules/users.ts',
  ]);
});

test('selects architecture, documentation, and focused tests for feature code', () => {
  const plan = buildChangeValidationPlan([
    'src/modules/users/users.controller.ts',
    'src/modules/users/users.controller.spec.ts',
    'docs/01-backend/modules/users.md',
  ]);

  assert.deepEqual(plan.focusedTestFiles, [
    'src/modules/users/users.controller.spec.ts',
    'src/modules/users/users.controller.ts',
  ]);
  assert.deepEqual(plan.conditionalScripts, ['arch:check', 'docs:check']);
  assert.deepEqual(plan.documentationViolations, []);
});

test('requires authoritative documentation for registered error changes', () => {
  const plan = buildChangeValidationPlan(['src/core/errors/error-definitions.ts']);

  assert.deepEqual(plan.conditionalScripts, ['arch:check', 'i18n:check', 'docs:check']);
  assert.deepEqual(plan.documentationViolations, [
    {
      reason: 'global error behavior changed',
      requiredFile: 'docs/01-backend/error-handling.md',
    },
    {
      reason: 'global error behavior changed',
      requiredFile: 'docs/02-api/error-catalog.md',
    },
  ]);
});

test('selects package hygiene only for dependency manifests', () => {
  const plan = buildChangeValidationPlan(['package.json', 'pnpm-lock.yaml']);

  assert.deepEqual(plan.conditionalScripts, [
    'deps:check',
    'deps:duplicates:check',
    'licenses:check',
    'audit:prod',
  ]);
});

test('selects tooling and Compose validation without unrelated gates', () => {
  const plan = buildChangeValidationPlan([
    'tools/docker.mjs',
    'compose.dev.yaml',
    'docs/04-deployment/docker.md',
  ]);

  assert.deepEqual(plan.conditionalScripts, ['docs:check', 'test:tools', 'docker:config']);
  assert.deepEqual(plan.documentationViolations, []);
});

test('requires configuration environment and documentation companions', () => {
  const plan = buildChangeValidationPlan(['src/config/swagger.config.ts', '.env.example']);

  assert.deepEqual(plan.documentationViolations, [
    {
      reason: 'runtime configuration changed',
      requiredFile: 'docs/01-backend/configuration.md',
    },
  ]);
});
