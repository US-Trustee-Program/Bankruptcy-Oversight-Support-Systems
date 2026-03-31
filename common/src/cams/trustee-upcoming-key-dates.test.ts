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
  validateMonthDay,
  validateMonthDayRange,
  validateTrusteeUpcomingKeyDates,
  validateTprDuePair,
} from './trustee-upcoming-key-dates';
import V from './validators';
import { VALID } from './validation';

describe('trustee-upcoming-key-dates date conversion helpers', () => {
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

describe('validateMonthDay', () => {
  test('returns VALID for empty string', () => {
    expect(validateMonthDay('')).toEqual(VALID);
  });

  test('returns VALID for null', () => {
    expect(validateMonthDay(null)).toEqual(VALID);
  });

  test('returns VALID for undefined', () => {
    expect(validateMonthDay(undefined)).toEqual(VALID);
  });

  test('returns VALID for a valid sentinel date', () => {
    expect(validateMonthDay('1900-04-30')).toEqual(VALID);
  });

  test('returns error for an invalid sentinel date (Feb 30)', () => {
    expect(validateMonthDay('1900-02-30')).toMatchObject({
      reasons: ['Must be a valid date mm/dd.'],
    });
  });

  test('returns error for a partial sentinel date (month only)', () => {
    expect(validateMonthDay('1900-04-')).toMatchObject({
      reasons: ['Must be a valid date mm/dd.'],
    });
  });

  test('returns error for a completely invalid string', () => {
    expect(validateMonthDay('not-a-date')).toMatchObject({
      reasons: ['Must be a valid date mm/dd.'],
    });
  });
});

describe('validateMonthDayRange', () => {
  test('returns VALID when both start and end are empty', () => {
    expect(validateMonthDayRange('', '')).toEqual(VALID);
  });

  test('returns VALID when both start and end are null', () => {
    expect(validateMonthDayRange(null, null)).toEqual(VALID);
  });

  test('returns VALID when both start and end are valid dates', () => {
    expect(validateMonthDayRange('1900-04-01', '1900-03-31')).toEqual(VALID);
  });

  test('returns error for invalid start date', () => {
    expect(validateMonthDayRange('1900-04-', '1900-03-31')).toMatchObject({
      reasons: ['Must be a valid date mm/dd.'],
    });
  });

  test('returns error for invalid end date', () => {
    expect(validateMonthDayRange('1900-04-01', '1900-13-45')).toMatchObject({
      reasons: ['Must be a valid date mm/dd.'],
    });
  });

  test('returns error when start is set but end is absent', () => {
    expect(validateMonthDayRange('1900-04-01', '')).toMatchObject({
      reasons: ['End date is required.'],
    });
  });

  test('returns error when end is set but start is absent', () => {
    expect(validateMonthDayRange('', '1900-03-31')).toMatchObject({
      reasons: ['Start date is required.'],
    });
  });

  test('invalid start date takes priority over pair validation', () => {
    // Start is invalid AND end is absent — should get the date error, not pair error
    expect(validateMonthDayRange('1900-04-', '')).toMatchObject({
      reasons: ['Must be a valid date mm/dd.'],
    });
  });
});

describe('validateTrusteeUpcomingKeyDates', () => {
  function baseInput() {
    return {
      trusteeId: 'trustee-001',
      appointmentId: 'appointment-001',
      pastFieldExam: null,
      pastAudit: null,
      tprReviewPeriodStart: null,
      tprReviewPeriodEnd: null,
      tprDue: null,
      tprDueYearType: null,
      tirReviewPeriodStart: null,
      tirReviewPeriodEnd: null,
      tirSubmission: null,
      tirReview: null,
      upcomingFieldExam: null,
      upcomingIndependentAuditRequired: null,
    };
  }

  test('returns VALID when all fields are null', () => {
    expect(validateTrusteeUpcomingKeyDates(baseInput())).toEqual(VALID);
  });

  test('returns VALID when all fields are populated with valid values', () => {
    expect(
      validateTrusteeUpcomingKeyDates({
        ...baseInput(),
        pastFieldExam: '2026-03-31',
        pastAudit: '2025-06-30',
        tprReviewPeriodStart: '1900-04-01',
        tprReviewPeriodEnd: '1900-03-31',
        tprDue: '1900-09-15',
        tprDueYearType: 'EVEN',
        tirReviewPeriodStart: '1900-07-01',
        tirReviewPeriodEnd: '1900-06-30',
        tirSubmission: '1900-10-15',
        tirReview: '1900-11-01',
        upcomingFieldExam: '2029-08-01',
        upcomingIndependentAuditRequired: '2032-08-01',
      }),
    ).toEqual(VALID);
  });

  test('returns error when tprReviewPeriodStart is set but tprReviewPeriodEnd is null', () => {
    const result = validateTrusteeUpcomingKeyDates({
      ...baseInput(),
      tprReviewPeriodStart: '1900-04-01',
      tprReviewPeriodEnd: null,
    });
    expect(result.valid).toBeFalsy();
    expect(result.reasonMap?.tprReviewPeriodEnd?.reasons?.[0]).toBe(
      'TPR Review Period End is required.',
    );
  });

  test('returns error when tprReviewPeriodEnd is set but tprReviewPeriodStart is null', () => {
    const result = validateTrusteeUpcomingKeyDates({
      ...baseInput(),
      tprReviewPeriodStart: null,
      tprReviewPeriodEnd: '1900-03-31',
    });
    expect(result.valid).toBeFalsy();
    expect(result.reasonMap?.tprReviewPeriodStart?.reasons?.[0]).toBe(
      'TPR Review Period Start is required.',
    );
  });

  test('returns error when tirReviewPeriodStart is set but tirReviewPeriodEnd is null', () => {
    const result = validateTrusteeUpcomingKeyDates({
      ...baseInput(),
      tirReviewPeriodStart: '1900-07-01',
      tirReviewPeriodEnd: null,
    });
    expect(result.valid).toBeFalsy();
    expect(result.reasonMap?.tirReviewPeriodEnd?.reasons?.[0]).toBe(
      'TIR Review Period End is required.',
    );
  });

  test('returns error when tprDue is set but tprDueYearType is null', () => {
    const result = validateTrusteeUpcomingKeyDates({
      ...baseInput(),
      tprDue: '1900-09-15',
      tprDueYearType: null,
    });
    expect(result.valid).toBeFalsy();
    expect(result.reasonMap?.tprDueYearType?.reasons?.[0]).toBe('TPR Due Year Type is required.');
  });

  test('returns error when tprDueYearType is set but tprDue is null', () => {
    const result = validateTrusteeUpcomingKeyDates({
      ...baseInput(),
      tprDue: null,
      tprDueYearType: 'EVEN',
    });
    expect(result.valid).toBeFalsy();
    expect(result.reasonMap?.tprDue?.reasons?.[0]).toBe('TPR Due is required.');
  });

  test('returns error when a sentinel date field contains an invalid ISO date', () => {
    const result = validateTrusteeUpcomingKeyDates({
      ...baseInput(),
      tprDue: '1900-02-30',
    });
    expect(result.valid).toBeFalsy();
    expect(result.reasonMap?.tprDue?.reasons?.[0]).toBe('Must be a valid date mm/dd.');
  });

  test('returns error when a full date field contains an invalid ISO date', () => {
    const result = validateTrusteeUpcomingKeyDates({
      ...baseInput(),
      pastFieldExam: '2026-13-01',
    });
    expect(result.valid).toBeFalsy();
    expect(result.reasonMap?.pastFieldExam?.reasons?.[0]).toBe('Must be a valid date mm/dd/yyyy.');
  });
});

describe('validateTprDuePair', () => {
  test('returns empty string when both are empty', () => {
    expect(validateTprDuePair('', '')).toBe('');
  });

  test('returns empty string when both are null', () => {
    expect(validateTprDuePair(null, null)).toBe('');
  });

  test('returns empty string when both are undefined', () => {
    expect(validateTprDuePair(undefined, undefined)).toBe('');
  });

  test('returns empty string when both tprDue and tprDueYearType are valid', () => {
    expect(validateTprDuePair('1900-09-15', 'EVEN')).toBe('');
  });

  test('returns date error when tprDue is an invalid partial date', () => {
    expect(validateTprDuePair('1900-04-', 'EVEN')).toBe('Must be a valid date mm/dd.');
  });

  test('returns "TPR Due Year Type is required." when tprDue is set but tprDueYearType is absent', () => {
    expect(validateTprDuePair('1900-09-15', '')).toBe('TPR Due Year Type is required.');
    expect(validateTprDuePair('1900-09-15', null)).toBe('TPR Due Year Type is required.');
  });

  test('returns date error when tprDueYearType is set but tprDue is absent', () => {
    const result = validateTprDuePair('', 'EVEN');
    expect(result).toBe('Must be a valid date mm/dd.');
  });
});
