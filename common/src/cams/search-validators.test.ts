import { describe, test, expect } from 'vitest';
import { validateObject } from './validation';
import {
  casesSearchPredicateSpec,
  caseNumber,
  debtorName,
  limit,
  offset,
  divisionCodes,
  chapters,
  caseIds,
  excludedCaseIds,
  atLeastOneSearchCriterion,
} from './search-validators';
import { CasesSearchPredicate } from '../api/search';

describe('Search Validators', () => {
  describe('caseNumber validator', () => {
    test.each([
      ['23-12345', true],
      ['99-00001', true],
      ['00-99999', true],
      ['123-45678', false], // Too many digits in year
      ['2-12345', false], // Too few digits in year
      ['23-1234', false], // Too few digits in case number
      ['23-123456', false], // Too many digits in case number
      ['AB-12345', false], // Letters in year
      ['23-ABCDE', false], // Letters in case number
      ['', false], // Empty string
      ['23_12345', false], // Wrong separator
    ])('should validate case number "%s" as valid=%s', (input, expectedValid) => {
      const result = validateObject({ caseNumber: [caseNumber] }, { caseNumber: input });
      expect(result.valid).toBe(expectedValid);
    });

    test('should allow undefined case number', () => {
      const result = validateObject({ caseNumber: [caseNumber] }, {});
      expect(result.valid).toBe(true);
    });
  });

  describe('debtorName validator', () => {
    test.each([
      ['Jo', true], // Minimum 2 characters
      ['John Doe', true],
      ['A'.repeat(200), true], // Maximum 200 characters
      ['J', false], // Too short
      ['A'.repeat(201), false], // Too long
      ['  Jo  ', true], // Should be trimmed before validation
      ['  J  ', false], // Should be trimmed, then too short
    ])('should validate debtor name "%s" as valid=%s', (input, expectedValid) => {
      const result = validateObject({ debtorName: [debtorName] }, { debtorName: input });
      expect(result.valid).toBe(expectedValid);

      if (!expectedValid && input.trim().length < 2) {
        expect(result.reasonMap?.debtorName?.reasons?.[0]).toContain('at least 2 characters');
      } else if (!expectedValid && input.trim().length > 200) {
        expect(result.reasonMap?.debtorName?.reasons?.[0]).toContain('not exceed 200 characters');
      }
    });

    test('should allow undefined debtor name', () => {
      const result = validateObject({ debtorName: [debtorName] }, {});
      expect(result.valid).toBe(true);
    });
  });

  describe('limit validator', () => {
    test.each([
      [1, true],
      [50, true],
      [100, true],
      [0, false], // Too small
      [101, false], // Too large
      [-1, false], // Negative
      ['25', true], // String that can be parsed
      ['101', false], // String too large
      ['abc', false], // Non-numeric string
    ])('should validate limit %s as valid=%s', (input, expectedValid) => {
      const result = validateObject({ limit: [limit] }, { limit: input });
      expect(result.valid).toBe(expectedValid);
    });

    test('should allow undefined limit', () => {
      const result = validateObject({ limit: [limit] }, {});
      expect(result.valid).toBe(true);
    });
  });

  describe('offset validator', () => {
    test.each([
      [0, true],
      [1, true],
      [1000000, true],
      [-1, false], // Negative
      ['0', true], // String that can be parsed
      ['100', true],
      ['-1', false], // Negative string
      ['abc', false], // Non-numeric string
    ])('should validate offset %s as valid=%s', (input, expectedValid) => {
      const result = validateObject({ offset: [offset] }, { offset: input });
      expect(result.valid).toBe(expectedValid);
    });

    test('should allow undefined offset', () => {
      const result = validateObject({ offset: [offset] }, {});
      expect(result.valid).toBe(true);
    });
  });

  describe('divisionCodes validator', () => {
    test('should validate array of valid division codes', () => {
      const result = validateObject(
        { divisionCodes: [divisionCodes] },
        { divisionCodes: ['081', '082', 'NYC'] }
      );
      expect(result.valid).toBe(true);
    });

    test('should reject invalid division codes', () => {
      const result = validateObject(
        { divisionCodes: [divisionCodes] },
        { divisionCodes: ['', 'A'.repeat(11)] } // Empty or too long
      );
      expect(result.valid).toBe(false);
      expect(result.reasonMap?.divisionCodes?.reasons?.[0]).toContain('Invalid division code');
    });

    test('should reject non-string values in array', () => {
      const result = validateObject(
        { divisionCodes: [divisionCodes] },
        { divisionCodes: [123, null] as any }
      );
      expect(result.valid).toBe(false);
    });

    test('should allow undefined division codes', () => {
      const result = validateObject({ divisionCodes: [divisionCodes] }, {});
      expect(result.valid).toBe(true);
    });
  });

  describe('chapters validator', () => {
    test.each([
      [['7'], true],
      [['11'], true],
      [['12'], true],
      [['13'], true],
      [['15'], true],
      [['7', '11', '13'], true],
      [['9'], false], // Invalid chapter
      [['7', '9'], false], // Mix of valid and invalid
      [['Chapter 7'], false], // Wrong format
    ])('should validate chapters %j as valid=%s', (input, expectedValid) => {
      const result = validateObject({ chapters: [chapters] }, { chapters: input });
      expect(result.valid).toBe(expectedValid);
    });

    test('should allow undefined chapters', () => {
      const result = validateObject({ chapters: [chapters] }, {});
      expect(result.valid).toBe(true);
    });
  });

  describe('caseIds validator', () => {
    test('should validate array of valid case IDs', () => {
      const result = validateObject(
        { caseIds: [caseIds] },
        { caseIds: ['case-123', 'case-456'] }
      );
      expect(result.valid).toBe(true);
    });

    test('should reject empty strings in case IDs', () => {
      const result = validateObject(
        { caseIds: [caseIds] },
        { caseIds: ['case-123', ''] }
      );
      expect(result.valid).toBe(false);
      expect(result.reasonMap?.caseIds?.reasons?.[0]).toContain('non-empty string');
    });

    test('should allow undefined case IDs', () => {
      const result = validateObject({ caseIds: [caseIds] }, {});
      expect(result.valid).toBe(true);
    });
  });

  describe('excludedCaseIds validator', () => {
    test('should validate array of valid excluded case IDs', () => {
      const result = validateObject(
        { excludedCaseIds: [excludedCaseIds] },
        { excludedCaseIds: ['case-789', 'case-012'] }
      );
      expect(result.valid).toBe(true);
    });

    test('should reject empty strings in excluded case IDs', () => {
      const result = validateObject(
        { excludedCaseIds: [excludedCaseIds] },
        { excludedCaseIds: [''] }
      );
      expect(result.valid).toBe(false);
    });

    test('should allow undefined excluded case IDs', () => {
      const result = validateObject({ excludedCaseIds: [excludedCaseIds] }, {});
      expect(result.valid).toBe(true);
    });
  });

  describe('atLeastOneSearchCriterion validator', () => {
    test('should pass when case number is provided', () => {
      const predicate: CasesSearchPredicate = {
        caseNumber: '23-12345',
      };
      const result = atLeastOneSearchCriterion(predicate);
      expect(result.valid).toBe(true);
    });

    test('should pass when valid debtor name is provided', () => {
      const predicate: CasesSearchPredicate = {
        debtorName: 'John Doe',
      };
      const result = atLeastOneSearchCriterion(predicate);
      expect(result.valid).toBe(true);
    });

    test('should fail when debtor name is too short', () => {
      const predicate: CasesSearchPredicate = {
        debtorName: 'J', // Too short
      };
      const result = atLeastOneSearchCriterion(predicate);
      expect(result.valid).toBe(false);
      expect(result.reasons?.[0]).toContain('At least one search criterion is required');
    });

    test('should pass when division codes are provided', () => {
      const predicate: CasesSearchPredicate = {
        divisionCodes: ['081'],
      };
      const result = atLeastOneSearchCriterion(predicate);
      expect(result.valid).toBe(true);
    });

    test('should pass when chapters are provided', () => {
      const predicate: CasesSearchPredicate = {
        chapters: ['7', '11'],
      };
      const result = atLeastOneSearchCriterion(predicate);
      expect(result.valid).toBe(true);
    });

    test('should pass when includeOnlyUnassigned is true', () => {
      const predicate: CasesSearchPredicate = {
        includeOnlyUnassigned: true,
      };
      const result = atLeastOneSearchCriterion(predicate);
      expect(result.valid).toBe(true);
    });

    test('should fail when no search criteria provided', () => {
      const predicate: CasesSearchPredicate = {};
      const result = atLeastOneSearchCriterion(predicate);
      expect(result.valid).toBe(false);
      expect(result.reasons?.[0]).toContain('At least one search criterion is required');
    });

    test('should fail when only boolean flags are false', () => {
      const predicate: CasesSearchPredicate = {
        excludeMemberConsolidations: false,
        excludeClosedCases: false,
        includeOnlyUnassigned: false,
      };
      const result = atLeastOneSearchCriterion(predicate);
      expect(result.valid).toBe(false);
    });
  });

  describe('casesSearchPredicateSpec - full validation', () => {
    test('should validate complete valid search predicate', () => {
      const predicate: CasesSearchPredicate = {
        caseNumber: '23-12345',
        debtorName: 'John Doe',
        divisionCodes: ['081', '082'],
        chapters: ['7', '11'],
        limit: 25,
        offset: 0,
      };
      const result = validateObject(casesSearchPredicateSpec, predicate);
      expect(result.valid).toBe(true);
    });

    test('should fail when no search criteria provided', () => {
      const predicate: CasesSearchPredicate = {
        limit: 25,
        offset: 0,
      };
      const result = validateObject(casesSearchPredicateSpec, predicate);
      expect(result.valid).toBe(false);
      expect(result.reasonMap?.$?.reasons?.[0]).toContain('At least one search criterion is required');
    });

    test('should fail with multiple validation errors', () => {
      const predicate: CasesSearchPredicate = {
        caseNumber: 'invalid-format',
        debtorName: 'A', // Too short
        limit: 200, // Too large
        offset: -1, // Negative
      };
      const result = validateObject(casesSearchPredicateSpec, predicate);
      expect(result.valid).toBe(false);
      expect(result.reasonMap?.caseNumber?.reasons).toBeDefined();
      expect(result.reasonMap?.debtorName?.reasons).toBeDefined();
      expect(result.reasonMap?.limit?.reasons).toBeDefined();
      expect(result.reasonMap?.offset?.reasons).toBeDefined();
    });

    test('should pass with minimal valid criteria', () => {
      const predicate: CasesSearchPredicate = {
        debtorName: 'Jo', // Minimum valid length
      };
      const result = validateObject(casesSearchPredicateSpec, predicate);
      expect(result.valid).toBe(true);
    });

    test('should handle edge case with whitespace-only debtor name', () => {
      const predicate: CasesSearchPredicate = {
        debtorName: '   ', // Should be trimmed to empty
      };
      const result = validateObject(casesSearchPredicateSpec, predicate);
      expect(result.valid).toBe(false);
      // Both field validation and at-least-one validation should fail
      expect(result.reasonMap?.debtorName?.reasons?.[0]).toContain('at least 2 characters');
      expect(result.reasonMap?.$?.reasons?.[0]).toContain('At least one search criterion is required');
    });
  });
});