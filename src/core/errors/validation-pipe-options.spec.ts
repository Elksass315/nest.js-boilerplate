import type { ValidationError } from '@nestjs/common';

import { AppException } from './app.exception';
import { validationPipeOptions } from './validation-pipe-options';

describe('validation pipe options', () => {
  it('maps nested validation failures to stable field paths', () => {
    const factory = validationPipeOptions.exceptionFactory;
    if (!factory) {
      throw new Error('Expected a validation exception factory');
    }
    const errors: ValidationError[] = [
      {
        property: 'profile',
        children: [
          {
            property: 'name',
            constraints: { isNotEmpty: 'name should not be empty' },
            children: [],
          },
        ],
      },
    ];

    const exception = factory(errors);

    expect(exception).toBeInstanceOf(AppException);
    expect((exception as AppException).getResponse()).toEqual({
      code: 'VALIDATION_ERROR',
      details: { fields: { 'profile.name': ['name should not be empty'] } },
    });
  });
});
