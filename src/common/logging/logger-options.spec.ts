import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Options } from 'pino-http';

import { createLoggerOptions, createRequestId } from './logger-options';

describe('logger options', () => {
  it('preserves a safe incoming request ID', () => {
    const response = { setHeader: jest.fn() } as unknown as ServerResponse;
    const request = { headers: { 'x-request-id': 'request-123' } } as unknown as IncomingMessage;

    expect(createRequestId(request, response)).toBe('request-123');
    expect(response.setHeader).toHaveBeenCalledWith('x-request-id', 'request-123');
  });

  it('replaces unsafe request IDs', () => {
    const response = { setHeader: jest.fn() } as unknown as ServerResponse;
    const request = { headers: { 'x-request-id': 'unsafe value' } } as unknown as IncomingMessage;

    expect(createRequestId(request, response)).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('creates redacted structured logger options', () => {
    expect(createLoggerOptions('info')).toEqual(
      expect.objectContaining({ pinoHttp: expect.objectContaining({ level: 'info' }) }),
    );
  });

  it('configures request metadata, health filtering, and serializers', () => {
    const options = createLoggerOptions('debug').pinoHttp as Options;

    expect(options.customProps?.({ id: 42 } as IncomingMessage, {} as ServerResponse)).toEqual({
      requestId: '42',
    });
    expect(
      options.customProps?.({ id: { source: 'test' } } as IncomingMessage, {} as ServerResponse),
    ).toEqual({ requestId: '{"source":"test"}' });

    const autoLogging = options.autoLogging;
    if (typeof autoLogging !== 'object') {
      throw new Error('Expected auto logging configuration');
    }

    expect(autoLogging.ignore?.({ url: '/health/live' } as IncomingMessage)).toBe(true);
    expect(autoLogging.ignore?.({ url: '/health/ready' } as IncomingMessage)).toBe(false);
    expect(options.serializers?.['req']?.({ id: 'id', method: 'GET', url: '/test' })).toEqual({
      id: 'id',
      method: 'GET',
      url: '/test',
    });
    expect(options.serializers?.['res']?.({ statusCode: 204 })).toEqual({ statusCode: 204 });
  });
});
