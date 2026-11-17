import { describe, test, expect } from 'vitest';
import { isAcmsTimeoutError } from './acms-timeout-error';

describe('isAcmsTimeoutError', () => {
  test.each([
    {
      description: 'a Timeout message',
      error: new Error('Timeout: request exceeded limit'),
      expected: true,
    },
    {
      description: 'a RequestError message',
      error: new Error('RequestError: connection refused'),
      expected: true,
    },
    { description: 'an unrelated Error', error: new Error('Some other error'), expected: false },
    { description: 'a non-Error value', error: 'Timeout', expected: false },
  ])('returns $expected for $description', ({ error, expected }) => {
    expect(isAcmsTimeoutError(error)).toBe(expected);
  });
});
