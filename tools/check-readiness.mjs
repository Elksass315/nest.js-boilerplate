import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { loadCapabilityManifest, validateCapabilityManifest } from './project-capabilities.mjs';

export const requiredReadinessFiles = [
  'capabilities.manifest.json',
  '.company-template-source.json',
  'deployment/migration-compatibility.json',
  'docs/governance/capability-matrix.md',
  'docs/governance/operational-ownership.md',
  'docs/governance/template-governance.md',
  'docs/03-dev-process/upgrade-guide.md',
  'docs/04-deployment/v1-readiness.md',
  'docs/adr/001-optional-capability-boundaries.md',
  'docs/adr/002-managed-recovery-and-migration-compatibility.md',
  'docs/adr/003-template-release-and-provenance.md',
];

export function checkReadiness(root = process.cwd()) {
  const violations = [];
  for (const relativePath of requiredReadinessFiles) {
    if (!existsSync(path.join(root, relativePath))) violations.push(`missing ${relativePath}`);
  }

  try {
    validateCapabilityManifest(loadCapabilityManifest(root));
  } catch (error) {
    violations.push(
      `invalid capability manifest: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  try {
    const compatibility = JSON.parse(
      readFileSync(path.join(root, 'deployment/migration-compatibility.json'), 'utf8'),
    );
    if (compatibility.compatibilityVersion !== 'expand-contract-v1') {
      violations.push('migration compatibility must declare expand-contract-v1');
    }
    if (compatibility.strategy !== 'expand-contract') {
      violations.push('migration compatibility must use expand-contract');
    }
    for (const required of [
      'backup-reference',
      'migration-success',
      'previous-image-compatibility',
    ]) {
      if (!compatibility.requiredChecks?.includes(required)) {
        violations.push(`migration compatibility missing required check ${required}`);
      }
    }
  } catch (error) {
    violations.push(
      `invalid migration compatibility: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  try {
    const packageJson = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'));
    for (const script of ['init:project', 'validate']) {
      if (typeof packageJson.scripts?.[script] !== 'string')
        violations.push(`package.json missing ${script} script`);
    }
  } catch (error) {
    violations.push(
      `invalid package.json: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  try {
    if (!readFileSync(path.join(root, 'Jenkinsfile'), 'utf8').includes('BACKUP_REFERENCE')) {
      violations.push('Jenkinsfile must require BACKUP_REFERENCE');
    }
  } catch {
    violations.push('missing Jenkinsfile');
  }
  return violations;
}

if (process.argv[1]?.endsWith('check-readiness.mjs')) {
  const violations = checkReadiness();
  if (violations.length > 0) {
    process.stderr.write(`Boilerplate v1 readiness contract failed:\n${violations.join('\n')}\n`);
    process.exitCode = 1;
  } else {
    process.stdout.write('Boilerplate v1 readiness contract passed\n');
  }
}
