import { describe, expect, test } from 'vitest';
import { TooManyRequestsError, isTooManyRequestsError } from './too-many-requests-error';
import HttpStatusCodes from '@common/api/http-status-codes';

describe('TooManyRequestsError', () => {
  const moduleName = 'TEST_MODULE';

  test('should create error with default message when no options provided', () => {
    const error = new TooManyRequestsError(moduleName);

    expect(error.module).toBe(moduleName);
    expect(error.message).toBe('Too Many Requests');
    expect(error.status).toBe(HttpStatusCodes.TOO_MANY_REQUESTS);
    expect(error.isCamsError).toBe(true);
  });

  test('should create error with custom message when provided', () => {
    const customMessage = 'Rate limit exceeded';
    const error = new TooManyRequestsError(moduleName, { message: customMessage });

    expect(error.module).toBe(moduleName);
    expect(error.message).toBe(customMessage);
    expect(error.status).toBe(HttpStatusCodes.TOO_MANY_REQUESTS);
    expect(error.isCamsError).toBe(true);
  });
});

describe('isTooManyRequestsError', () => {
  test('should return true for a TooManyRequestsError', () => {
    const error = new TooManyRequestsError('TEST_MODULE');
    expect(isTooManyRequestsError(error)).toBe(true);
  });

  test('should return false for non-TooManyRequestsError', () => {
    const error = new Error('some error');
    expect(isTooManyRequestsError(error)).toBe(false);
  });

  test('should return false for null', () => {
    expect(isTooManyRequestsError(null)).toBe(false);
  });
});
