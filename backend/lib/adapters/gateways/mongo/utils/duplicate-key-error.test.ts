import { isDuplicateKeyError } from './duplicate-key-error';

describe('isDuplicateKeyError', () => {
  test.each([
    { name: 'an E11000 message', error: new Error('E11000 duplicate key error collection: x') },
    { name: 'a "duplicate key" message in any case', error: new Error('Duplicate Key violation') },
    { name: 'a plain object with a matching message', error: { message: 'E11000' } },
  ])('should detect $name', ({ error }) => {
    expect(isDuplicateKeyError(error)).toBe(true);
  });

  test.each([
    { name: 'an unrelated error', error: new Error('connection reset') },
    { name: 'an object without a message', error: { code: 11000 } },
    { name: 'a string', error: 'E11000' },
    { name: 'null', error: null },
    { name: 'undefined', error: undefined },
    { name: 'a non-string message', error: { message: 11000 } },
  ])('should not detect $name', ({ error }) => {
    expect(isDuplicateKeyError(error)).toBe(false);
  });
});
