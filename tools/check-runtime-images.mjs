import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

const POLICIES = {
  postgres: {
    major: 18,
    minimum: [18, 6, 0],
    suffix: 'bookworm',
    composeCount: 1,
    ciCount: 2,
  },
  redis: {
    major: 8,
    minimum: [8, 4, 5],
    suffix: 'trixie',
    composeCount: 1,
    ciCount: 2,
  },
};

const REDIS_TRIVY_EXCEPTION = 'CVE-2026-14456';

function compareVersions(left, right) {
  for (let index = 0; index < 3; index += 1) {
    const difference = (left[index] ?? 0) - (right[index] ?? 0);
    if (difference !== 0) return difference;
  }
  return 0;
}

export function findImageReferences(content, image) {
  const pattern =
    /(postgres|redis):([0-9]+)[.]([0-9]+)(?:[.]([0-9]+))?-([a-z0-9.]+)@sha256:([a-f0-9]{64})/g;

  return [...content.matchAll(pattern)]
    .filter((match) => match[1] === image)
    .map((match) => ({
      reference: match[0],
      version: [Number(match[2]), Number(match[3]), Number(match[4] ?? 0)],
      suffix: match[5],
    }));
}

export function validateRuntimeImages({
  compose,
  ci,
  dependabot,
  redisTrivyIgnore,
  currentDate = new Date(),
}) {
  const violations = [];

  for (const [image, policy] of Object.entries(POLICIES)) {
    const composeReferences = findImageReferences(compose, image);
    const ciReferences = findImageReferences(ci, image);

    if (composeReferences.length !== policy.composeCount) {
      violations.push(
        `${image} must appear ${String(policy.composeCount)} time in compose.yaml with an exact version and digest`,
      );
      continue;
    }
    if (ciReferences.length !== policy.ciCount) {
      violations.push(
        `${image} must appear ${String(policy.ciCount)} times in CI (service and image scan)`,
      );
      continue;
    }

    const expected = composeReferences[0];
    if (!expected) continue;

    if (expected.version[0] !== policy.major) {
      violations.push(`${image} must stay on approved major ${String(policy.major)}`);
    }
    if (compareVersions(expected.version, policy.minimum) < 0) {
      violations.push(`${image} is below the approved security floor`);
    }
    if (expected.suffix !== policy.suffix) {
      violations.push(`${image} must use the approved ${policy.suffix} variant`);
    }
    if (ciReferences.some(({ reference }) => reference !== expected.reference)) {
      violations.push(`${image} references differ between Compose and CI`);
    }
  }

  if (!/package-ecosystem:\s*docker[\s\S]*?directory:\s*\/[\r\n]/.test(dependabot)) {
    violations.push('Dependabot must monitor Docker manifests in the repository root');
  }

  const redisScanUsesScopedIgnore = new RegExp(
    `- name:\\s*Scan Redis service image[\\s\\S]{0,500}?image-ref:\\s*redis:[^\\r\\n]+[\\s\\S]{0,500}?trivyignores:\\s*\\.trivyignore\\.redis`,
  ).test(ci);
  if (!redisScanUsesScopedIgnore) {
    violations.push('The Redis image scan must use .trivyignore.redis');
  }

  const activeRedisExceptions = redisTrivyIgnore
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith('#'));
  if (activeRedisExceptions.length !== 1 || activeRedisExceptions[0] !== REDIS_TRIVY_EXCEPTION) {
    violations.push(`Redis may ignore only ${REDIS_TRIVY_EXCEPTION}`);
  }

  const expiryMatch = redisTrivyIgnore.match(/expires (\d{4}-\d{2}-\d{2})/i);
  if (!redisTrivyIgnore.includes('Redis does not expose or use QUIC')) {
    violations.push('The Redis Trivy exception must document why it is not exploitable');
  }
  if (!expiryMatch) {
    violations.push('The Redis Trivy exception must declare an expiry date');
  } else {
    const expiryDate = new Date(`${expiryMatch[1]}T23:59:59.999Z`);
    if (Number.isNaN(expiryDate.getTime()) || currentDate > expiryDate) {
      violations.push(`The Redis Trivy exception expired on ${expiryMatch[1]}`);
    }
  }

  return violations;
}

if (pathToFileURL(resolve(process.argv[1] ?? '')).href === import.meta.url) {
  const violations = validateRuntimeImages({
    compose: readFileSync('compose.yaml', 'utf8'),
    ci: readFileSync('.github/workflows/ci.yml', 'utf8'),
    dependabot: readFileSync('.github/dependabot.yml', 'utf8'),
    redisTrivyIgnore: readFileSync('.trivyignore.redis', 'utf8'),
  });

  if (violations.length > 0) {
    process.stderr.write(`Runtime image contract violations:\n${violations.join('\n')}\n`);
    process.exitCode = 1;
  }
}
