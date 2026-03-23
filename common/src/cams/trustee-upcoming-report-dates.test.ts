import { describe, test, expect } from 'vitest';
import {
  isoToMMDDYYYY,
  isoToMMYYYY,
  isoToMMDD,
  isoRangeToMMDD,
  mmddyyyyToISO,
  mmyyyyToISO,
  mmddToISO,
  validateMMDDYYYY,
  validateMMYYYY,
  validateMMDD,
  validateMMDDRange,
  calculateTirSubmission,
  calculateTirReview,
  calculateNextAuditDate,
} from './trustee-upcoming-report-dates';
import V from './validators';
import { VALID } from './validation';

describe('trustee-upcoming-report-dates date conversion helpers', () => {
  describe('isoToMMDDYYYY', () => {
    test('converts standard date', () => {
      expect(isoToMMDDYYYY('2026-02-21')).toBe('02/21/2026');
    });

    test('pads single-digit month and day', () => {
      expect(isoToMMDDYYYY('2026-03-05')).toBe('03/05/2026');
    });

    test('converts year-end boundary date', () => {
      expect(isoToMMDDYYYY('2025-12-31')).toBe('12/31/2025');
    });

    test('converts year-start boundary date', () => {
      expect(isoToMMDDYYYY('2025-01-01')).toBe('01/01/2025');
    });
  });

  describe('isoToMMYYYY', () => {
    test('converts standard month/year', () => {
      expect(isoToMMYYYY('2026-02-01')).toBe('02/2026');
    });

    test('pads single-digit month', () => {
      expect(isoToMMYYYY('2026-03-01')).toBe('03/2026');
    });

    test('converts December', () => {
      expect(isoToMMYYYY('2025-12-01')).toBe('12/2025');
    });
  });

  describe('isoToMMDD', () => {
    test('converts sentinel year date', () => {
      expect(isoToMMDD('1900-04-30')).toBe('04/30');
    });

    test('pads single-digit month and day', () => {
      expect(isoToMMDD('1900-03-05')).toBe('03/05');
    });

    test('converts year-end boundary', () => {
      expect(isoToMMDD('1900-12-31')).toBe('12/31');
    });
  });

  describe('isoRangeToMMDD', () => {
    test('formats range crossing year boundary', () => {
      expect(isoRangeToMMDD('1900-04-01', '1900-03-31')).toBe('04/01 - 03/31');
    });

    test('formats same-month range', () => {
      expect(isoRangeToMMDD('1900-06-01', '1900-06-30')).toBe('06/01 - 06/30');
    });

    test('formats single-day range', () => {
      expect(isoRangeToMMDD('1900-01-15', '1900-01-15')).toBe('01/15 - 01/15');
    });
  });

  describe('mmddyyyyToISO', () => {
    test('converts standard date', () => {
      expect(mmddyyyyToISO('02/21/2026')).toBe('2026-02-21');
    });

    test('preserves zero-padded month and day', () => {
      expect(mmddyyyyToISO('03/05/2026')).toBe('2026-03-05');
    });

    test('converts year-end boundary', () => {
      expect(mmddyyyyToISO('12/31/2025')).toBe('2025-12-31');
    });
  });

  describe('mmyyyyToISO', () => {
    test('converts standard month/year', () => {
      expect(mmyyyyToISO('02/2026')).toBe('2026-02-01');
    });

    test('preserves zero-padded month', () => {
      expect(mmyyyyToISO('03/2026')).toBe('2026-03-01');
    });

    test('converts December', () => {
      expect(mmyyyyToISO('12/2025')).toBe('2025-12-01');
    });
  });

  describe('mmddToISO', () => {
    test('converts standard mm/dd with sentinel year', () => {
      expect(mmddToISO('04/30')).toBe('1900-04-30');
    });

    test('preserves zero-padded month and day', () => {
      expect(mmddToISO('03/05')).toBe('1900-03-05');
    });

    test('converts year-end boundary', () => {
      expect(mmddToISO('12/31')).toBe('1900-12-31');
    });
  });
});

describe('display-format validators', () => {
  describe('validateMMDDYYYY', () => {
    test('valid date passes', () => {
      expect(validateMMDDYYYY('02/21/2026')).toEqual(VALID);
    });

    test('zero-padded month and day pass', () => {
      expect(validateMMDDYYYY('03/05/2026')).toEqual(VALID);
    });

    test('invalid month fails with correct error', () => {
      expect(validateMMDDYYYY('13/15/2026')).toMatchObject({
        reasons: ['Must be a valid date mm/dd/yyyy.'],
      });
    });

    test('invalid day fails', () => {
      expect(validateMMDDYYYY('02/32/2026')).toMatchObject({
        reasons: ['Must be a valid date mm/dd/yyyy.'],
      });
    });

    test('invalid calendar date (Feb 30) fails', () => {
      expect(validateMMDDYYYY('02/30/2026')).toMatchObject({
        reasons: ['Must be a valid date mm/dd/yyyy.'],
      });
    });

    test('wrong format fails', () => {
      expect(validateMMDDYYYY('2/21/2026')).toMatchObject({
        reasons: ['Must be a valid date mm/dd/yyyy.'],
      });
    });
  });

  describe('validateMMYYYY', () => {
    test('valid month/year passes', () => {
      expect(validateMMYYYY('02/2026')).toEqual(VALID);
    });

    test('December passes', () => {
      expect(validateMMYYYY('12/2025')).toEqual(VALID);
    });

    test('invalid month 13 fails with correct error', () => {
      expect(validateMMYYYY('13/2026')).toMatchObject({
        reasons: ['Must be a valid date mm/yyyy.'],
      });
    });

    test('invalid month 00 fails', () => {
      expect(validateMMYYYY('00/2026')).toMatchObject({
        reasons: ['Must be a valid date mm/yyyy.'],
      });
    });

    test('wrong format fails', () => {
      expect(validateMMYYYY('2/2026')).toMatchObject({
        reasons: ['Must be a valid date mm/yyyy.'],
      });
    });
  });

  describe('validateMMDD', () => {
    test('valid date passes', () => {
      expect(validateMMDD('04/30')).toEqual(VALID);
    });

    test('Feb 29 passes (uses leap year 2000)', () => {
      expect(validateMMDD('02/29')).toEqual(VALID);
    });

    test('invalid month and day fails with correct error', () => {
      expect(validateMMDD('13/45')).toMatchObject({
        reasons: ['Must be a valid date mm/dd.'],
      });
    });

    test('invalid calendar date (Feb 30) fails', () => {
      expect(validateMMDD('02/30')).toMatchObject({
        reasons: ['Must be a valid date mm/dd.'],
      });
    });

    test('wrong format fails', () => {
      expect(validateMMDD('4/30')).toMatchObject({
        reasons: ['Must be a valid date mm/dd.'],
      });
    });
  });

  describe('validateMMDDRange', () => {
    test('valid range passes', () => {
      expect(validateMMDDRange('04/01 - 03/31')).toEqual(VALID);
    });

    test('same-month range passes', () => {
      expect(validateMMDDRange('06/01 - 06/30')).toEqual(VALID);
    });

    test('invalid start fails with correct error', () => {
      expect(validateMMDDRange('13/45 - 01/15')).toMatchObject({
        reasons: ['Must be a valid date mm/dd.'],
      });
    });

    test('invalid end fails', () => {
      expect(validateMMDDRange('01/15 - 13/45')).toMatchObject({
        reasons: ['Must be a valid date mm/dd.'],
      });
    });

    test('wrong format (single date) fails', () => {
      expect(validateMMDDRange('04/01')).toMatchObject({
        reasons: ['Must be a valid date mm/dd.'],
      });
    });
  });

  describe('V.optional with validateMMDDYYYY', () => {
    test('skips validation when value is absent (undefined)', () => {
      expect(V.optional(validateMMDDYYYY)(undefined)).toEqual(VALID);
    });

    test('validates when value is present', () => {
      expect(V.optional(validateMMDDYYYY)('02/21/2026')).toEqual(VALID);
      expect(V.optional(validateMMDDYYYY)('13/45/2026')).toMatchObject({
        reasons: ['Must be a valid date mm/dd/yyyy.'],
      });
    });
  });
});

describe('calculation helpers', () => {
  describe('calculateTirSubmission', () => {
    test('adds 30 days to a standard quarter-end', () => {
      expect(calculateTirSubmission('1900-03-31')).toBe('1900-04-30');
    });

    test('adds 30 days to June 30', () => {
      expect(calculateTirSubmission('1900-06-30')).toBe('1900-07-30');
    });

    test('adds 30 days to September 30', () => {
      expect(calculateTirSubmission('1900-09-30')).toBe('1900-10-30');
    });

    test('adds 30 days to December 31, wrapping to next month', () => {
      expect(calculateTirSubmission('1900-12-31')).toBe('1900-01-30');
    });

    test('adds 30 days crossing a month boundary', () => {
      expect(calculateTirSubmission('1900-01-15')).toBe('1900-02-14');
    });
  });

  describe('calculateTirReview', () => {
    test('adds 60 days to April 30', () => {
      expect(calculateTirReview('1900-04-30')).toBe('1900-06-29');
    });

    test('adds 60 days to July 30', () => {
      expect(calculateTirReview('1900-07-30')).toBe('1900-09-28');
    });

    test('adds 60 days to October 30', () => {
      expect(calculateTirReview('1900-10-30')).toBe('1900-12-29');
    });

    test('adds 60 days wrapping past year end', () => {
      expect(calculateTirReview('1900-11-30')).toBe('1900-01-29');
    });
  });

  describe('calculateNextAuditDate', () => {
    test('returns null when both inputs are undefined', () => {
      expect(calculateNextAuditDate(undefined, undefined, 3)).toBeNull();
    });

    test('uses fieldExam when audit is undefined', () => {
      expect(calculateNextAuditDate('2025-03-31', undefined, 3)).toBe('2028-03-01');
    });

    test('uses audit when fieldExam is undefined', () => {
      expect(calculateNextAuditDate(undefined, '2025-06-30', 3)).toBe('2028-06-01');
    });

    test('uses the most recent date when both are provided', () => {
      expect(calculateNextAuditDate('2023-03-31', '2025-06-30', 3)).toBe('2028-06-01');
    });

    test('uses fieldExam when it is more recent than audit', () => {
      expect(calculateNextAuditDate('2025-09-30', '2024-12-31', 3)).toBe('2028-09-01');
    });

    test('aligns to next quarter end when result is mid-quarter', () => {
      // 2025-04-15 + 3 years = 2028-04-15, which aligns to 2028-06-30
      expect(calculateNextAuditDate('2025-04-15', undefined, 3)).toBe('2028-06-01');
    });

    test('calculates 6-year independent audit date', () => {
      expect(calculateNextAuditDate('2025-03-31', undefined, 6)).toBe('2031-03-01');
    });

    test('calculates 6-year date using most recent of both', () => {
      expect(calculateNextAuditDate('2023-03-31', '2025-06-30', 6)).toBe('2031-06-01');
    });

    test('aligns December date to December 31 quarter end', () => {
      expect(calculateNextAuditDate('2025-12-31', undefined, 3)).toBe('2028-12-01');
    });

    test('aligns mid-December date to December 31 quarter end', () => {
      // 2025-10-15 + 3 years = 2028-10-15, aligns to 2028-12-31
      expect(calculateNextAuditDate('2025-10-15', undefined, 3)).toBe('2028-12-01');
    });
  });
});
