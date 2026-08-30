import { ERROR_DEFINITIONS } from '@/core/errors/error-definitions';

import { swaggerErrorContent, swaggerErrorExample } from './api-error-response';

describe('Swagger stable error examples', () => {
  it('derives status, code, and message from the stable error definition', () => {
    expect(swaggerErrorExample('USER_NOT_FOUND', '/api/v1/users/:id')).toMatchObject({
      statusCode: ERROR_DEFINITIONS.USER_NOT_FOUND.status,
      code: 'USER_NOT_FOUND',
      message: ERROR_DEFINITIONS.USER_NOT_FOUND.fallbackMessage,
      path: '/api/v1/users/:id',
    });
  });

  it('adds safe details only when supplied', () => {
    expect(
      swaggerErrorContent('VALIDATION_ERROR', '/api/v1/users', {
        fields: { email: ['email must be an email'] },
      })['application/json'].example,
    ).toMatchObject({ details: { fields: { email: ['email must be an email'] } } });
  });
});
