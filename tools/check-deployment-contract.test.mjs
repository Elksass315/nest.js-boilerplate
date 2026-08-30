import assert from 'node:assert/strict';
import test from 'node:test';

import { validateDeploymentContract } from './check-deployment-contract.mjs';

const baseCompose = `services:\n  api:\n  mail-worker:\n  file-worker:\n  outbox-worker:\n  maintenance-worker:\n`;
const developmentCompose = `${baseCompose}  postgres:\n  redis:\n  mailpit:\n  localstack:\n`;
const deploymentCompose = `${baseCompose}  migrate:\n  seed:\n`;
const dockerfile =
  'LABEL org.opencontainers.image.migration-compatibility=$MIGRATION_COMPATIBILITY\n' +
  'migration-compatibility.json';
const manifest = JSON.stringify({ compatibilityVersion: 'expand-contract-v1' });
const jenkinsfile =
  'BACKUP_REFERENCE migration-compatibility outbox-worker maintenance-worker health/ready ioredis MAIL_SMTP_HOST HeadBucketCommand';

test('accepts managed deployment layering and rollback gates', () => {
  assert.deepEqual(
    validateDeploymentContract({
      baseCompose,
      developmentCompose,
      deploymentCompose,
      dockerfile,
      compatibilityManifest: manifest,
      jenkinsfile,
    }),
    [],
  );
});

test('rejects managed dependencies in the deployment layer and missing rollback metadata', () => {
  const violations = validateDeploymentContract({
    baseCompose: `${baseCompose}  redis:\n`,
    developmentCompose,
    deploymentCompose: `${deploymentCompose}  postgres:\n`,
    dockerfile: '',
    compatibilityManifest: '{}',
    jenkinsfile: '',
  });
  assert.ok(violations.some((violation) => violation.includes('redis')));
  assert.ok(violations.some((violation) => violation.includes('postgres')));
  assert.ok(violations.some((violation) => violation.includes('compatibility')));
});
