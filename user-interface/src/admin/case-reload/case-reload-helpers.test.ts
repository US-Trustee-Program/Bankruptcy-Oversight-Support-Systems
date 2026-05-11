import { describe, test, expect } from 'vitest';
import { buildCaseId, parseApiValidationError } from './case-reload-helpers';

describe('case-reload-helpers', () => {
  describe('buildCaseId', () => {
    test('should build case ID from division code and case number', () => {
      const result = buildCaseId('081', '23-12345');

      expect(result).toBe('081-23-12345');
    });
  });

  describe('parseApiValidationError', () => {
    test('should return "Case Not Found" for 404 errors', () => {
      const error = new Error('404 Error - /cases/081-23-12345 - Not found');

      const result = parseApiValidationError(error);

      expect(result).toBe('Case Not Found');
    });

    test('should extract error message for non-404 errors', () => {
      const error = new Error('400 Error - /cases/081-23-12345 - Invalid case format');

      const result = parseApiValidationError(error);

      expect(result).toBe('Invalid case format');
    });

    test('should return default message when error does not match expected format', () => {
      expect(parseApiValidationError(new Error('Something went wrong'))).toBe(
        'Error encountered attempting to verify the case ID',
      );
      expect(parseApiValidationError(new Error())).toBe(
        'Error encountered attempting to verify the case ID',
      );
    });

    test('should handle non-Error objects with a message property', () => {
      const error = { message: '404 Error - /path - Not found' };

      const result = parseApiValidationError(error);

      expect(result).toBe('Case Not Found');
    });
  });
});
