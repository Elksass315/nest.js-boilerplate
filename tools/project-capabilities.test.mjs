import assert from 'node:assert/strict';
import test from 'node:test';

import {
  loadCapabilityManifest,
  resolveCapabilities,
  validateCapabilityManifest,
} from './project-capabilities.mjs';

test('manifest is valid and exposes the mandatory stack', () => {
  const manifest = validateCapabilityManifest(loadCapabilityManifest());
  assert.deepEqual(manifest.mandatory, [
    'core',
    'authorization',
    'users',
    'auth',
    'sessions',
    'security-audits',
    'mail',
    'outbox',
    'workers',
  ]);
});

test('avatar selection automatically includes files before the dependent capability', () => {
  const result = resolveCapabilities(['user-avatars']);
  assert.ok(result.selected.includes('files'));
  assert.ok(result.selected.indexOf('files') < result.selected.indexOf('user-avatars'));
  assert.deepEqual(result.addedDependencies, ['files']);
});

test('all optional capabilities can be selected together without duplicates', () => {
  const result = resolveCapabilities([
    'files',
    'user-avatars',
    'invitations',
    'feature-flags',
    'sentry',
  ]);
  assert.equal(new Set(result.selected).size, result.selected.length);
  assert.deepEqual(result.selected.slice(-5), [
    'files',
    'user-avatars',
    'invitations',
    'feature-flags',
    'sentry',
  ]);
});

test('unknown optional capabilities are rejected', () => {
  assert.throws(() => resolveCapabilities(['billing']), /Unknown or mandatory/);
});
