import { describe, test, expect } from 'vitest';
import { validateObject, validateEach } from './validation';
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
    test.each(['23-12345', '99-00001', '00-99999'])(
      'should accept valid case number "%s"',
      (input) => {
        const result = validateEach([caseNumber], input);
        expect(result.valid).toBe(true);
      },
    );

    test.each([
      ['123-45678', 'too many digits in year'],
      ['2-12345', 'too few digits in year'],
      ['23-1234', 'too few digits in case number'],
      ['23-123456', 'too many digits in case number'],
      ['AB-12345', 'letters in year'],
      ['23-ABCDE', 'letters in case number'],
      ['', 'empty string'],
      ['23_12345', 'wrong separator'],
    ])('should reject invalid case number "%s" (%s)', (input, _reason) => {
      const result = validateEach([caseNumber], input);
      expect(result.valid).toBeFalsy();
    });

    test('should allow undefined case number', () => {
      const result = validateEach([caseNumber], undefined);
      expect(result.valid).toBe(true);
    });
  });

  describe('debtorName validator', () => {
    test.each(['Jo', 'John Doe', 'A'.repeat(200), '  Jo  '])(
      'should accept valid debtor name "%s"',
      (input) => {
        const result = validateEach([debtorName], input);
        expect(result.valid).toBe(true);
      },
    );

    test.each(['J', '  J  '])('should reject debtor name "%s" as too short', (input) => {
      const result = validateEach([debtorName], input);
      expect(result.valid).toBeFalsy();
      expect(result.reasons?.[0]).toContain('at least 2 characters');
    });

    test('should reject debtor name exceeding maximum length', () => {
      const result = validateEach([debtorName], 'A'.repeat(201));
      expect(result.valid).toBeFalsy();
      expect(result.reasons?.[0]).toContain('not exceed 200 characters');
    });

    test('should allow undefined debtor name', () => {
      const result = validateEach([debtorName], undefined);
      expect(result.valid).toBe(true);
    });
  });

  describe('limit validator', () => {
    test.each([1, 50, 100, '25'])('should accept valid limit %s', (input) => {
      const result = validateEach([limit], input);
      expect(result.valid).toBe(true);
    });

    test.each([
      [0, 'too small'],
      [101, 'too large'],
      [-1, 'negative'],
      ['101', 'string too large'],
      ['abc', 'non-numeric string'],
    ])('should reject invalid limit %s (%s)', (input, _reason) => {
      const result = validateEach([limit], input);
      expect(result.valid).toBeFalsy();
    });

    test('should allow undefined limit', () => {
      const result = validateEach([limit], undefined);
      expect(result.valid).toBe(true);
    });
  });

  describe('offset validator', () => {
    test.each([0, 1, 1000000, '0', '100'])('should accept valid offset %s', (input) => {
      const result = validateEach([offset], input);
      expect(result.valid).toBe(true);
    });

    test.each([
      [-1, 'negative'],
      ['-1', 'negative string'],
      ['abc', 'non-numeric string'],
    ])('should reject invalid offset %s (%s)', (input, _reason) => {
      const result = validateEach([offset], input);
      expect(result.valid).toBeFalsy();
    });

    test('should allow undefined offset', () => {
      const result = validateEach([offset], undefined);
      expect(result.valid).toBe(true);
    });
  });

  describe('divisionCodes validator', () => {
    test('should validate array of valid division codes', () => {
      const result = validateEach([divisionCodes], ['081', '082', 'NYC']);
      expect(result.valid).toBe(true);
    });

    test('should reject invalid division codes', () => {
      const result = validateEach([divisionCodes], ['', 'A'.repeat(11)]);
      expect(result.valid).toBeFalsy();
      expect(result.reasons?.[0]).toContain('Invalid division code');
    });

    test('should reject non-string values in array', () => {
      const result = validateEach([divisionCodes], [123, null]);
      expect(result.valid).toBeFalsy();
    });

    test('should allow undefined division codes', () => {
      const result = validateEach([divisionCodes], undefined);
      expect(result.valid).toBe(true);
    });
  });

  describe('chapters validator', () => {
    test.each([[['7']], [['11']], [['12']], [['13']], [['15']], [['7', '11', '13']]])(
      'should accept valid chapters %j',
      (input) => {
        const result = validateEach([chapters], input);
        expect(result.valid).toBe(true);
      },
    );

    test.each([
      [['9'], 'invalid chapter'],
      [['7', '9'], 'mix of valid and invalid'],
      [['Chapter 7'], 'wrong format'],
    ])('should reject invalid chapters %j (%s)', (input, _reason) => {
      const result = validateEach([chapters], input);
      expect(result.valid).toBeFalsy();
    });

    test('should allow undefined chapters', () => {
      const result = validateEach([chapters], undefined);
      expect(result.valid).toBe(true);
    });
  });

  describe('caseIds validator', () => {
    test('should validate array of valid case IDs', () => {
      const result = validateEach([caseIds], ['case-123', 'case-456']);
      expect(result.valid).toBe(true);
    });

    test('should reject empty strings in case IDs', () => {
      const result = validateEach([caseIds], ['case-123', '']);
      expect(result.valid).toBeFalsy();
      expect(result.reasons?.[0]).toContain('non-empty string');
    });

    test('should allow undefined case IDs', () => {
      const result = validateEach([caseIds], undefined);
      expect(result.valid).toBe(true);
    });
  });

  describe('excludedCaseIds validator', () => {
    test('should validate array of valid excluded case IDs', () => {
      const result = validateEach([excludedCaseIds], ['case-789', 'case-012']);
      expect(result.valid).toBe(true);
    });

    test('should reject empty strings in excluded case IDs', () => {
      const result = validateEach([excludedCaseIds], ['']);
      expect(result.valid).toBeFalsy();
    });

    test('should allow undefined excluded case IDs', () => {
      const result = validateEach([excludedCaseIds], undefined);
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
        debtorName: 'J',
      };
      const result = atLeastOneSearchCriterion(predicate);
      expect(result.valid).toBeFalsy();
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
      expect(result.valid).toBeFalsy();
      expect(result.reasons?.[0]).toContain('At least one search criterion is required');
    });

    test('should fail when only boolean flags are false', () => {
      const predicate: CasesSearchPredicate = {
        excludeMemberConsolidations: false,
        excludeClosedCases: false,
        includeOnlyUnassigned: false,
      };
      const result = atLeastOneSearchCriterion(predicate);
      expect(result.valid).toBeFalsy();
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
      expect(result.valid).toBeFalsy();
      expect(result.reasonMap?.$?.reasons?.[0]).toContain(
        'At least one search criterion is required',
      );
    });

    test('should fail with multiple validation errors', () => {
      const predicate: CasesSearchPredicate = {
        caseNumber: 'invalid-format',
        debtorName: 'A',
        limit: 200,
        offset: -1,
      };
      const result = validateObject(casesSearchPredicateSpec, predicate);
      expect(result.valid).toBeFalsy();
      expect(result.reasonMap?.caseNumber?.reasons).toBeDefined();
      expect(result.reasonMap?.debtorName?.reasons).toBeDefined();
      expect(result.reasonMap?.limit?.reasons).toBeDefined();
      expect(result.reasonMap?.offset?.reasons).toBeDefined();
    });

    test('should pass with minimal valid criteria', () => {
      const predicate: CasesSearchPredicate = {
        debtorName: 'Jo',
      };
      const result = validateObject(casesSearchPredicateSpec, predicate);
      expect(result.valid).toBe(true);
    });

    test('should handle edge case with whitespace-only debtor name', () => {
      const predicate: CasesSearchPredicate = {
        debtorName: '   ',
      };
      const result = validateObject(casesSearchPredicateSpec, predicate);
      expect(result.valid).toBeFalsy();
      expect(result.reasonMap?.debtorName?.reasons?.[0]).toContain('at least 2 characters');
      expect(result.reasonMap?.$?.reasons?.[0]).toContain(
        'At least one search criterion is required',
      );
    });
  });
});
