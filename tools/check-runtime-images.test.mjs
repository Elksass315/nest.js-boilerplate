import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { findImageReferences, validateRuntimeImages } from './check-runtime-images.mjs';

const postgres =
  'postgres:18.6-bookworm@sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const redis =
  'redis:8.4.7-alpine@sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
const dependabot = '- package-ecosystem: docker\n  directory: /\n';

describe('runtime image contract', () => {
  it('accepts synchronized Compose, CI service, and CI scan references', () => {
    assert.deepEqual(
      validateRuntimeImages({
        compose: `${postgres}\n${redis}\n`,
        ci: `${postgres}\n${postgres}\n${redis}\n${redis}\n`,
        dependabot,
      }),
      [],
    );
  });

  it('rejects stale, drifting, unscanned, and unmonitored images', () => {
    const violations = validateRuntimeImages({
      compose: `${postgres.replace('18.6', '18.5')}\n${redis}\n`,
      ci: `${postgres}\n${postgres}\n${redis}\n`,
      dependabot: '',
    });

    assert.ok(violations.some((violation) => violation.includes('postgres')));
    assert.ok(violations.some((violation) => violation.includes('redis')));
    assert.ok(violations.some((violation) => violation.includes('Dependabot')));
  });

  it('only extracts exact patch tags pinned by a full digest', () => {
    assert.equal(findImageReferences(postgres, 'postgres').length, 1);
    assert.equal(findImageReferences('postgres:18-bookworm@sha256:abc', 'postgres').length, 0);
  });

  it('rejects a Redis variant other than the approved one', () => {
    const violations = validateRuntimeImages({
      compose: `${postgres}
${redis.replace('alpine', 'trixie')}
`,
      ci: `${postgres}
${postgres}
${redis}
${redis}
`,
      dependabot,
    });

    assert.ok(violations.some((violation) => violation.includes('approved alpine variant')));
  });
});
