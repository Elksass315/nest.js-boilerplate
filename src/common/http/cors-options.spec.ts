import { createCorsOptions } from './cors-options';

describe(createCorsOptions.name, () => {
  const options = createCorsOptions(['https://app.example.com']);
  const resolveOrigin = options.origin;

  if (typeof resolveOrigin !== 'function') throw new Error('Expected a dynamic CORS origin policy');

  it('bypasses CORS middleware for requests without an Origin header', () => {
    const callback = jest.fn();

    resolveOrigin(undefined, callback);

    expect(callback).toHaveBeenCalledWith(null, false);
  });

  it.each([
    ['configured', 'https://app.example.com', true],
    ['unconfigured', 'https://other.example.com', false],
  ])('marks a %s browser origin as allowed=%s', (_label, origin, expected) => {
    const callback = jest.fn();

    resolveOrigin(origin, callback);

    expect(callback).toHaveBeenCalledWith(null, expected);
  });
});
