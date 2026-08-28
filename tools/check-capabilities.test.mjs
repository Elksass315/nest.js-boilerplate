import assert from 'node:assert/strict';
import test from 'node:test';

import { checkCapabilityBoundaries } from './check-capabilities.mjs';

test('optional capability boundaries and manifest validation pass', () => {
  assert.doesNotThrow(() => checkCapabilityBoundaries());
});
