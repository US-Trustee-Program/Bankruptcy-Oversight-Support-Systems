import { describe, test, expect } from 'vitest';
import { buildCaseId, parseApiValidationError } from './case-reload-helpers';

describe('case-reload-helpers', () => {
  describe('buildCaseId', () => {
    test('should build case ID from division code and case number', () => {
      const result = buildCaseId('081', '23-12345');

      expect(result).toBe('081-23-12345');
    });

    test('should handle different division codes', () => {
      expect(buildCaseId('091', '24-67890')).toBe('091-24-67890');
      expect(buildCaseId('101', '25-11111')).toBe('101-25-11111');
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

    test('should extract error message for 500 errors', () => {
      const error = new Error('500 Error - /cases/081-23-12345 - Internal server error');

      const result = parseApiValidationError(error);

      expect(result).toBe('Internal server error');
    });

    test('should return default message for unparseable errors', () => {
      const error = new Error('Something went wrong');

      const result = parseApiValidationError(error);

      expect(result).toBe('Error encountered attempting to verify the case ID');
    });

    test('should handle errors without messages', () => {
      const error = new Error();

      const result = parseApiValidationError(error);

      expect(result).toBe('Error encountered attempting to verify the case ID');
    });

    test('should handle non-Error objects', () => {
      const error = { message: '404 Error - /path - Not found' };

      const result = parseApiValidationError(error);

      expect(result).toBe('Case Not Found');
    });
  });
});
