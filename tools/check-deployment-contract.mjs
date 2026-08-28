import { readFileSync } from 'node:fs';
import process from 'node:process';

function hasService(compose, service) {
  return new RegExp(`^\\s{2}${service}:\\s*$`, 'm').test(compose);
}

export function validateDeploymentContract({
  baseCompose,
  developmentCompose,
  deploymentCompose,
  dockerfile,
  compatibilityManifest,
  jenkinsfile,
}) {
  const violations = [];
  for (const service of ['postgres', 'redis', 'mailpit', 'localstack']) {
    if (hasService(baseCompose, service)) {
      violations.push(`${service} must be defined only in the development Compose layer`);
    }
    if (!hasService(developmentCompose, service)) {
      violations.push(`${service} must be present in the development Compose layer`);
    }
    if (hasService(deploymentCompose, service)) {
      violations.push(`${service} must not be created by the deployment Compose layer`);
    }
  }
  for (const service of ['api', 'mail-worker', 'file-worker', 'outbox-worker']) {
    if (!hasService(baseCompose, service) || !hasService(deploymentCompose, service)) {
      violations.push(`${service} must use the shared immutable image in every runtime layer`);
    }
  }
  for (const job of ['migrate', 'seed']) {
    if (!hasService(deploymentCompose, job)) {
      violations.push(`deployment Compose must define the ${job} one-shot job`);
    }
  }

  let manifest;
  try {
    manifest = JSON.parse(compatibilityManifest);
  } catch {
    violations.push('migration compatibility manifest must be valid JSON');
    manifest = null;
  }
  if (!manifest || manifest.compatibilityVersion !== 'expand-contract-v1') {
    violations.push('migration compatibility manifest must declare expand-contract-v1');
  }
  if (!dockerfile.includes('org.opencontainers.image.migration-compatibility')) {
    violations.push('runtime image must carry the migration compatibility OCI label');
  }
  if (!dockerfile.includes('migration-compatibility.json')) {
    violations.push('runtime image must include the migration compatibility manifest');
  }
  for (const required of [
    'BACKUP_REFERENCE',
    'migration-compatibility',
    'outbox-worker',
    'health/ready',
    'ioredis',
    'MAIL_SMTP_HOST',
    'HeadBucketCommand',
  ]) {
    if (!jenkinsfile.includes(required)) {
      violations.push(`Jenkins deployment must include ${required}`);
    }
  }
  return violations;
}

if (process.argv[1]?.endsWith('check-deployment-contract.mjs')) {
  const violations = validateDeploymentContract({
    baseCompose: readFileSync('compose.yaml', 'utf8'),
    developmentCompose: readFileSync('compose.dev.yaml', 'utf8'),
    deploymentCompose: readFileSync('compose.deploy.yaml', 'utf8'),
    dockerfile: readFileSync('docker/Dockerfile', 'utf8'),
    compatibilityManifest: readFileSync('deployment/migration-compatibility.json', 'utf8'),
    jenkinsfile: readFileSync('Jenkinsfile', 'utf8'),
  });
  if (violations.length > 0) {
    process.stderr.write(`Deployment contract violations:\n${violations.join('\n')}\n`);
    process.exitCode = 1;
  }
}
