import { describe, test, expect } from 'vitest';
import { isDuplicateKeyError } from './duplicate-key-error';

describe('isDuplicateKeyError', () => {
  test.each([
    ['an E11000 message', new Error('E11000 collection: cams.trustee-variation'), true],
    ['a "duplicate key" message', new Error('Duplicate Key error'), true],
    ['an unrelated message', new Error('Write failed'), false],
    ['an object with no message', {}, false],
    ['a string', 'E11000', false],
    ['null', null, false],
    ['undefined', undefined, false],
  ])('%s -> %s', (_label, error, expected) => {
    expect(isDuplicateKeyError(error)).toBe(expected);
  });
});
