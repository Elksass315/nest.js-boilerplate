import assert from 'node:assert/strict';
import test from 'node:test';

import { resolvedProfiles } from './validate-capability-profiles.mjs';

test('profile enumeration deduplicates dependency shorthand to 24 resolved profiles', () => {
  const profiles = resolvedProfiles();
  assert.equal(profiles.length, 24);
  assert.ok(
    profiles.some(
      ({ requested, resolved }) =>
        requested.length === 1 &&
        requested[0] === 'user-avatars' &&
        resolved.join(',') === 'files,user-avatars',
    ),
  );
});
