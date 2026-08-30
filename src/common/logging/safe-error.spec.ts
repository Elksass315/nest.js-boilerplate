import { QueryFailedError } from 'typeorm';

import { projectSafeError } from './safe-error';

describe('projectSafeError', () => {
  it('does not project exception messages or query text', () => {
    const error = new QueryFailedError(
      'INSERT INTO users(password) VALUES ($1)',
      ['secret'],
      Object.assign(new Error('password=secret'), { code: '23505', constraint: 'users_email_key' }),
    );

    expect(projectSafeError(error)).toEqual({
      errorType: 'QueryFailedError',
      databaseCode: '23505',
      databaseConstraint: 'users_email_key',
    });
  });

  it('only exposes an error type for unknown failures', () => {
    expect(projectSafeError(new Error('token=secret'))).toEqual({ errorType: 'Error' });
  });
});
