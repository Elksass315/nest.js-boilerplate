import assert from 'node:assert/strict';
import { cpSync, existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import test from 'node:test';

import {
  assertUntouchedTemplate,
  initializeProject,
  normalizeProjectConfig,
} from './init-project.mjs';

const rootRepository = path.resolve('.');

function validConfig() {
  return {
    displayName: 'Acme API',
    packageName: 'acme-api',
    repositorySlug: 'acme-api',
    apiTitle: 'Acme API',
    databaseName: 'acme',
    imageRegistry: 'registry.example.test/acme',
    deploymentRoot: '/srv/acme',
    codeowners: '@acme/platform',
    defaultLanguage: 'en',
    emailBranding: 'Acme',
    supportAddress: 'support@acme.test',
    capabilities: ['files', 'user-avatars', 'invitations', 'feature-flags', 'sentry'],
    fileDriver: 'local-development-plus-s3-production',
  };
}

test('normalizes the fully wired reference profile', () => {
  const result = normalizeProjectConfig(validConfig());
  assert.deepEqual(result.resolvedCapabilities.slice(-5), validConfig().capabilities);
  assert.deepEqual(result.addedDependencies, []);
});

test('fails closed instead of generating a partially wired profile', () => {
  assert.throws(
    () => normalizeProjectConfig({ ...validConfig(), capabilities: ['user-avatars'] }),
    /Selective capability generation is not supported yet.*invitations, feature-flags, sentry/,
  );
});

test('requires the source marker, a clean worktree, and refuses a second initialization', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'nestjs-init-'));
  try {
    assert.throws(() => assertUntouchedTemplate(root), /marker is missing/);
    writeFileSync(path.join(root, '.company-template-source.json'), '{}');
    execFileSync('git', ['init', '--initial-branch=feature/init-fixture'], { cwd: root });
    writeFileSync(path.join(root, 'dirty.txt'), 'uncommitted');
    assert.throws(() => assertUntouchedTemplate(root), /clean git worktree/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('dry-run resolves capabilities without writing project metadata', async () => {
  const root = mkdtempSync(path.join(tmpdir(), 'nestjs-init-dry-'));
  try {
    cpSync(
      path.join(rootRepository, 'capabilities.manifest.json'),
      path.join(root, 'capabilities.manifest.json'),
    );
    cpSync(
      path.join(rootRepository, '.company-template-source.json'),
      path.join(root, '.company-template-source.json'),
    );
    const configFile = writeConfig(root);
    execFileSync('git', ['init', '--initial-branch=feature/init-fixture'], { cwd: root });
    execFileSync('git', ['config', 'user.email', 'fixture@example.test'], { cwd: root });
    execFileSync('git', ['config', 'user.name', 'Fixture'], { cwd: root });
    execFileSync('git', ['add', '.'], { cwd: root });
    execFileSync('git', ['commit', '-m', 'fixture'], { cwd: root, stdio: 'ignore' });
    const result = await initializeProject({
      root,
      dryRun: true,
      skipValidation: true,
      config: configFile,
    });
    assert.equal(result.branch, 'feature/init-fixture');
    assert.equal(existsSync(path.join(root, '.company-template.json')), false);
    assert.deepEqual(result.config.addedDependencies, []);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

function writeConfig(root) {
  const file = path.join(root, 'initializer.json');
  writeFileSync(file, JSON.stringify(validConfig()));
  return file;
}
