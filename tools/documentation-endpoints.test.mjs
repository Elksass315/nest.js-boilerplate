import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { extractDocumentedEndpoints } from './documentation-endpoints.mjs';

describe('module endpoint tables', () => {
  it('extracts individual and combined methods while normalizing the API prefix', () => {
    const endpoints = extractDocumentedEndpoints(`| Method | Route |
| --- | --- |
| GET | \`/api/v1/users\` |
| POST/HEAD | \`/users/uploads/:id\` |
`);

    assert.deepEqual(
      [...endpoints],
      ['GET /users', 'POST /users/uploads/:id', 'HEAD /users/uploads/:id'],
    );
  });
});
