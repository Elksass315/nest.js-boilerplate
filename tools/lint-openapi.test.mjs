import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { lintOpenApi } from './lint-openapi.mjs';

function documentFor(operation) {
  return {
    openapi: '3.0.0',
    paths: { '/api/v1/widgets': { post: operation } },
    'x-stable-errors': {
      VALIDATION_ERROR: { statusCode: 422, message: 'Input validation failed' },
    },
  };
}

describe('generated OpenAPI contract lint', () => {
  it('accepts complete request, success, and stable error examples', () => {
    const violations = lintOpenApi(
      documentFor({
        operationId: 'WidgetsController_create',
        summary: 'Create a widget',
        description: 'Creates one validated widget.',
        requestBody: {
          content: { 'application/json': { example: { name: 'Example widget' } } },
        },
        responses: {
          201: { content: { 'application/json': { example: { id: 'widget-example' } } } },
          422: {
            content: {
              'application/json': {
                example: {
                  statusCode: 422,
                  code: 'VALIDATION_ERROR',
                  message: 'Input validation failed',
                },
              },
            },
          },
        },
      }),
    );

    assert.deepEqual(violations, []);
  });

  it('rejects missing examples and inconsistent stable errors', () => {
    const violations = lintOpenApi(
      documentFor({
        operationId: 'WidgetsController_create',
        summary: 'Create a widget',
        description: 'Creates one validated widget.',
        requestBody: { content: { 'application/json': { schema: { type: 'object' } } } },
        responses: {
          201: { content: { 'application/json': { schema: { type: 'object' } } } },
          422: {
            content: {
              'application/json': {
                example: { statusCode: 422, code: 'UNKNOWN', message: 'Wrong message' },
              },
            },
          },
        },
      }),
    );

    assert.equal(violations.length, 3);
  });
});
