import { createLoggingConfig } from './logging.config';

describe('logging configuration', () => {
  it('maps the configured log level', () => {
    expect(createLoggingConfig({ LOG_LEVEL: 'debug' })).toEqual({ level: 'debug' });
  });
});
