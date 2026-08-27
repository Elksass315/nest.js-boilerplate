import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { findImageReferences, validateRuntimeImages } from './check-runtime-images.mjs';

const postgres =
  'postgres:18.6-bookworm@sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const redis =
  'redis:8.4.6-trixie@sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
const dependabot = '- package-ecosystem: docker\n  directory: /\n';
const redisTrivyIgnore = `# Redis does not expose or use QUIC.
# Temporary exception; expires 2026-09-30.
CVE-2026-14456
`;
const redisScan = `- name: Scan Redis service image
  image-ref: ${redis}
  trivyignores: .trivyignore.redis`;
const currentDate = new Date('2026-08-27T00:00:00.000Z');

describe('runtime image contract', () => {
  it('accepts synchronized Compose, CI service, and CI scan references', () => {
    assert.deepEqual(
      validateRuntimeImages({
        compose: `${postgres}\n${redis}\n`,
        ci: `${postgres}\n${postgres}\n${redis}\n${redisScan}\n`,
        dependabot,
        redisTrivyIgnore,
        currentDate,
      }),
      [],
    );
  });

  it('rejects stale, drifting, unscanned, and unmonitored images', () => {
    const violations = validateRuntimeImages({
      compose: `${postgres.replace('18.6', '18.5')}\n${redis}\n`,
      ci: `${postgres}\n${postgres}\n${redis}\n`,
      dependabot: '',
      redisTrivyIgnore: '',
      currentDate,
    });

    assert.ok(violations.some((violation) => violation.includes('postgres')));
    assert.ok(violations.some((violation) => violation.includes('redis')));
    assert.ok(violations.some((violation) => violation.includes('Dependabot')));
  });

  it('only extracts exact patch tags pinned by a full digest', () => {
    assert.equal(findImageReferences(postgres, 'postgres').length, 1);
    assert.equal(findImageReferences('postgres:18-bookworm@sha256:abc', 'postgres').length, 0);
  });

  it('rejects additional or expired Redis scan exceptions', () => {
    const violations = validateRuntimeImages({
      compose: `${postgres}\n${redis}\n`,
      ci: `${postgres}\n${postgres}\n${redis}\n${redisScan}\n`,
      dependabot,
      redisTrivyIgnore: `${redisTrivyIgnore}CVE-2099-0001\n`,
      currentDate: new Date('2026-10-01T00:00:00.000Z'),
    });

    assert.ok(violations.some((violation) => violation.includes('may ignore only')));
    assert.ok(violations.some((violation) => violation.includes('expired')));
  });
});
