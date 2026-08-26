import { readBoolean, readNumber, readString } from './environment-reader';

describe('environment readers', () => {
  it('reads validated primitive values', () => {
    expect(readString({ VALUE: 'text' }, 'VALUE')).toBe('text');
    expect(readNumber({ VALUE: 42 }, 'VALUE')).toBe(42);
    expect(readBoolean({ VALUE: true }, 'VALUE')).toBe(true);
  });

  it.each([
    ['string', readString, 42],
    ['number', readNumber, '42'],
    ['boolean', readBoolean, 'true'],
  ])('rejects a non-%s value', (_type, reader, value) => {
    expect(() => reader({ VALUE: value }, 'VALUE')).toThrow('Validated environment value VALUE');
  });

  it('rejects non-finite numbers', () => {
    expect(() => readNumber({ VALUE: Number.NaN }, 'VALUE')).toThrow(
      'Validated environment value VALUE is not a number',
    );
  });
});
