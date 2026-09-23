import { describe, test, expect } from 'vitest';
import {
  isoToMMDDYYYY,
  isoToMMYYYY,
  isoToMMDD,
  isoRangeToMMDD,
  mmddyyyyToISO,
  mmyyyyToISO,
  mmddToISO,
  isoToSentinel,
  validateMMDDYYYY,
  validateMMYYYY,
  validateMMDD,
  validateMMDDRange,
  calculateTirSubmission,
  calculateTirReview,
  calculateNextAuditDate,
  calculateAuditReqBy,
  calculateTprDueYear,
  validateMonthDay,
  validateMonthDayRange,
  validateTrusteeUpcomingKeyDates,
  validateTprDuePair,
  validateTprReviewPeriodOrder,
  validateCompletionPairPresence,
  DATE_FIELDS,
  SCALAR_FIELDS,
  TEXT_FIELDS,
} from './trustee-upcoming-key-dates';
import { VALID } from './validation';

describe('trustee-upcoming-key-dates date conversion helpers', () => {
  test.each([
    ['2026-02-21', '02/21/2026'],
    ['2026-03-05', '03/05/2026'],
    ['2025-12-31', '12/31/2025'],
    ['2025-01-01', '01/01/2025'],
  ])('isoToMMDDYYYY(%s) -> %s', (input, expected) => {
    expect(isoToMMDDYYYY(input)).toBe(expected);
  });

  test.each([
    ['2026-02-01', '02/2026'],
    ['2026-03-01', '03/2026'],
    ['2025-12-01', '12/2025'],
  ])('isoToMMYYYY(%s) -> %s', (input, expected) => {
    expect(isoToMMYYYY(input)).toBe(expected);
  });

  test.each([
    ['1900-04-30', '04/30'],
    ['1900-03-05', '03/05'],
    ['1900-12-31', '12/31'],
  ])('isoToMMDD(%s) -> %s', (input, expected) => {
    expect(isoToMMDD(input)).toBe(expected);
  });

  test.each([
    ['1900-04-01', '1900-03-31', '04/01 - 03/31'],
    ['1900-06-01', '1900-06-30', '06/01 - 06/30'],
    ['1900-01-15', '1900-01-15', '01/15 - 01/15'],
  ])('isoRangeToMMDD(%s, %s) -> %s', (start, end, expected) => {
    expect(isoRangeToMMDD(start, end)).toBe(expected);
  });

  test.each([
    ['02/21/2026', '2026-02-21'],
    ['03/05/2026', '2026-03-05'],
    ['12/31/2025', '2025-12-31'],
  ])('mmddyyyyToISO(%s) -> %s', (input, expected) => {
    expect(mmddyyyyToISO(input)).toBe(expected);
  });

  test.each([
    ['02/2026', '2026-02-01'],
    ['03/2026', '2026-03-01'],
    ['12/2025', '2025-12-01'],
  ])('mmyyyyToISO(%s) -> %s', (input, expected) => {
    expect(mmyyyyToISO(input)).toBe(expected);
  });

  test.each([
    ['04/30', '1900-04-30'],
    ['03/05', '1900-03-05'],
    ['12/31', '1900-12-31'],
  ])('mmddToISO(%s) -> %s', (input, expected) => {
    expect(mmddToISO(input)).toBe(expected);
  });
});

describe('display-format validators', () => {
  describe('validateMMDDYYYY', () => {
    test.each([['02/21/2026'], ['03/05/2026']])('%s passes', (value) => {
      expect(validateMMDDYYYY(value)).toEqual(VALID);
    });

    test.each([
      ['13/15/2026', 'invalid month'],
      ['02/32/2026', 'invalid day'],
      ['02/30/2026', 'invalid calendar date (Feb 30)'],
      ['2/21/2026', 'wrong format'],
      ['x02/21/2026', 'leading characters before the pattern'],
      ['02/21/2026x', 'trailing characters after the pattern'],
    ])('%s fails (%s)', (value) => {
      expect(validateMMDDYYYY(value)).toMatchObject({
        reasons: ['Must be a valid date mm/dd/yyyy.'],
      });
    });

    test('returns error for non-string input', () => {
      expect(validateMMDDYYYY(null)).toMatchObject({
        reasons: ['Must be a valid date mm/dd/yyyy.'],
      });
    });
  });

  describe('validateMMYYYY', () => {
    test.each([['02/2026'], ['12/2025'], ['01/2026']])('%s passes', (value) => {
      expect(validateMMYYYY(value)).toEqual(VALID);
    });

    test.each([
      ['13/2026', 'invalid month 13'],
      ['00/2026', 'invalid month 00'],
      ['2/2026', 'wrong format'],
      ['x02/2026', 'leading characters'],
      ['02/2026x', 'trailing characters'],
    ])('%s fails (%s)', (value) => {
      expect(validateMMYYYY(value)).toMatchObject({
        reasons: ['Must be a valid date mm/yyyy.'],
      });
    });

    test('returns error for non-string input', () => {
      expect(validateMMYYYY(null)).toMatchObject({ reasons: ['Must be a valid date mm/yyyy.'] });
    });
  });

  describe('validateMMDD', () => {
    test.each([
      ['04/30', 'valid date'],
      ['02/29', 'Feb 29 (uses leap year 2000)'],
    ])('%s passes (%s)', (value) => {
      expect(validateMMDD(value)).toEqual(VALID);
    });

    test.each([
      ['13/45', 'invalid month and day'],
      ['02/30', 'invalid calendar date (Feb 30)'],
      ['4/30', 'wrong format'],
      ['x04/30', 'leading characters'],
      ['04/30x', 'trailing characters'],
    ])('%s fails (%s)', (value) => {
      expect(validateMMDD(value)).toMatchObject({
        reasons: ['Must be a valid date mm/dd.'],
      });
    });

    test('returns error for non-string input', () => {
      expect(validateMMDD(null)).toMatchObject({ reasons: ['Must be a valid date mm/dd.'] });
    });
  });

  describe('validateMMDDRange', () => {
    test.each([
      ['04/01 - 03/31', 'valid range'],
      ['06/01 - 06/30', 'same-month range'],
    ])('%s passes (%s)', (value) => {
      expect(validateMMDDRange(value)).toEqual(VALID);
    });

    test.each([
      ['13/45 - 01/15', 'invalid start'],
      ['01/15 - 13/45', 'invalid end'],
      ['04/01', 'wrong format (single date)'],
      ['x04/01 - 03/31', 'leading characters'],
      ['04/01 - 03/31x', 'trailing characters'],
    ])('%s fails (%s)', (value) => {
      expect(validateMMDDRange(value)).toMatchObject({
        reasons: ['Must be a valid date mm/dd.'],
      });
    });

    test('returns error for non-string input', () => {
      expect(validateMMDDRange(null)).toMatchObject({ reasons: ['Must be a valid date mm/dd.'] });
    });
  });
});

describe('calculation helpers', () => {
  describe('calculateTirSubmission', () => {
    test.each([
      ['1900-03-31', '1900-04-30', 'standard quarter-end'],
      ['1900-06-30', '1900-07-30', 'June 30'],
      ['1900-09-30', '1900-10-30', 'September 30'],
      ['1900-12-31', '1900-01-30', 'December 31, wrapping to next month'],
      ['1900-01-15', '1900-02-14', 'crossing a month boundary'],
      ['1900-04-01', '1900-05-01', 'day is zero-padded when result day is single digit'],
    ])('adds 30 days to %s -> %s (%s)', (input, expected) => {
      expect(calculateTirSubmission(input)).toBe(expected);
    });
  });

  describe('calculateTirReview', () => {
    test.each([
      ['1900-04-30', '1900-06-29'],
      ['1900-07-30', '1900-09-28'],
      ['1900-10-30', '1900-12-29'],
      ['1900-11-30', '1900-01-29'],
    ])('adds 60 days to %s -> %s', (input, expected) => {
      expect(calculateTirReview(input)).toBe(expected);
    });
  });

  describe('calculateNextAuditDate', () => {
    test('returns null when both inputs are undefined', () => {
      expect(calculateNextAuditDate(undefined, undefined, 3)).toBeNull();
    });

    test.each([
      ['2025-03-31', undefined, 3, '2028-03-01', 'uses fieldExam when audit is undefined'],
      [undefined, '2025-06-30', 3, '2028-06-01', 'uses audit when fieldExam is undefined'],
      [
        '2023-03-31',
        '2025-06-30',
        3,
        '2028-06-01',
        'uses the most recent date when both are provided',
      ],
      [
        '2025-09-30',
        '2024-12-31',
        3,
        '2028-09-01',
        'uses fieldExam when it is more recent than audit',
      ],
      [
        '2025-04-15',
        undefined,
        3,
        '2028-06-01',
        'aligns to next quarter end when result is mid-quarter',
      ],
      ['2025-03-31', undefined, 6, '2031-03-01', 'calculates 6-year independent audit date'],
      [
        '2023-03-31',
        '2025-06-30',
        6,
        '2031-06-01',
        'calculates 6-year date using most recent of both',
      ],
      ['2025-12-31', undefined, 3, '2028-12-01', 'aligns December date to December 31 quarter end'],
      [
        '2025-10-15',
        undefined,
        3,
        '2028-12-01',
        'aligns mid-December date to December 31 quarter end',
      ],
      [
        '2025-03-31',
        undefined,
        3,
        '2028-03-01',
        'date exactly on March 31 aligns to March 31 (not next quarter)',
      ],
      ['2025-06-30', undefined, 3, '2028-06-01', 'date exactly on June 30 aligns to June 30'],
      [
        '2025-04-01',
        undefined,
        3,
        '2028-06-01',
        'date on April 1 (after March 31 quarter end) aligns to June 30',
      ],
      ['2025-09-30', undefined, 3, '2028-09-01', 'date on September 30 aligns to September 30'],
      [
        '2025-10-01',
        undefined,
        3,
        '2028-12-01',
        'date on October 1 (after September 30) aligns to December 31',
      ],
    ])('%s / %s / +%i years -> %s (%s)', (fieldExam, audit, years, expected, _desc) => {
      expect(calculateNextAuditDate(fieldExam, audit, years)).toBe(expected);
    });
  });
});

describe('validateMonthDay', () => {
  test.each([
    ['', 'empty string'],
    [null, 'null'],
    [undefined, 'undefined'],
    ['1900-04-30', 'a valid sentinel date'],
  ])('returns VALID for %s (%s)', (value, _desc) => {
    expect(validateMonthDay(value)).toEqual(VALID);
  });

  test.each([
    ['1900-02-30', 'an invalid sentinel date (Feb 30)'],
    ['1900-04-', 'a partial sentinel date (month only)'],
    ['not-a-date', 'a completely invalid string'],
  ])('returns error for %s (%s)', (value, _desc) => {
    expect(validateMonthDay(value)).toMatchObject({
      reasons: ['Must be a valid date mm/dd.'],
    });
  });
});

describe('validateMonthDayRange', () => {
  test.each([
    ['', '', 'both start and end are empty'],
    [null, null, 'both start and end are null'],
    ['1900-04-01', '1900-03-31', 'both start and end are valid dates'],
  ])('returns VALID when %s', (start, end, _desc) => {
    expect(validateMonthDayRange(start, end)).toEqual(VALID);
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
      pastBackgroundQuestion: null,
      pastFieldExam: null,
      pastAudit: null,
      pastTprSubmission: null,
      lastTprSubmitted: null,
      tprReviewPeriodStart: null,
      tprReviewPeriodEnd: null,
      tprDue: null,
      tprDueYearType: null,
      tprFrequency: null,
      tirReviewPeriodStart: null,
      tirReviewPeriodEnd: null,
      tirSubmission: null,
      tirReview: null,
      upcomingExamOrAuditYear: null,
      upcomingExamOrAuditType: null,
      tirFrequency: null,
      tirSemiAnnualReviewPeriodStart: null,
      tirSemiAnnualReviewPeriodEnd: null,
      tirSemiAnnualSubmission: null,
      tirSemiAnnualReview: null,
      lastAuditFiscalYear: null,
      auditCompletionYear: null,
      auditCompletionStatus: null,
      tprCompletionYear: null,
      tprCompletionStatus: null,
      tirCompletionYear: null,
      tirCompletionStatus: null,
      lastMonthlyReportReceived: null,
      leaseExpiration: null,
      idExpiration: null,
      lastCompensationStudy: null,
      bondIssuedDate: null,
      bondRenewalDate: null,
      annualReportCompletionYear: null,
      annualReportCompletionStatus: null,
      ch13AuditCompletionYear: null,
      ch13AuditCompletionStatus: null,
      ch13TprCompletionYear: null,
      ch13TprCompletionStatus: null,
    };
  }

  test('returns VALID when all fields are null', () => {
    expect(validateTrusteeUpcomingKeyDates(baseInput())).toEqual(VALID);
  });

  test('returns error when annualReportCompletionYear is set but annualReportCompletionStatus is null', () => {
    const result = validateTrusteeUpcomingKeyDates({
      ...baseInput(),
      annualReportCompletionYear: 2026,
      annualReportCompletionStatus: null,
    });
    expect(result.valid).toBeFalsy();
    expect(result.reasonMap?.annualReportCompletionStatus?.reasons?.[0]).toBe(
      'Annual Report Completion Status is required.',
    );
  });

  test('returns error when annualReportCompletionStatus is set but annualReportCompletionYear is null', () => {
    const result = validateTrusteeUpcomingKeyDates({
      ...baseInput(),
      annualReportCompletionYear: null,
      annualReportCompletionStatus: 'INCOMPLETE',
    });
    expect(result.valid).toBeFalsy();
    expect(result.reasonMap?.annualReportCompletionYear?.reasons?.[0]).toBe(
      'Annual Report Completion Status Year is required.',
    );
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
        tprFrequency: 'ANNUAL',
        tirReviewPeriodStart: '1900-07-01',
        tirReviewPeriodEnd: '1900-06-30',
        tirSubmission: '1900-10-15',
        tirReview: '1900-11-01',
        upcomingExamOrAuditYear: 2029,
        upcomingExamOrAuditType: 'Field Exam',
        tirFrequency: 'ANNUAL',
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

  test('returns VALID when tprReviewPeriodStart is before tprReviewPeriodEnd (full ISO dates)', () => {
    expect(
      validateTrusteeUpcomingKeyDates({
        ...baseInput(),
        tprReviewPeriodStart: '2025-01-01',
        tprReviewPeriodEnd: '2026-12-31',
      }),
    ).toEqual(VALID);
  });

  test('returns VALID when tprReviewPeriodStart equals tprReviewPeriodEnd (same day)', () => {
    expect(
      validateTrusteeUpcomingKeyDates({
        ...baseInput(),
        tprReviewPeriodStart: '2025-06-30',
        tprReviewPeriodEnd: '2025-06-30',
      }),
    ).toEqual(VALID);
  });

  test('returns VALID for sentinel-format tprReviewPeriod dates that cross a year boundary', () => {
    // Apr 1 – Mar 31 is a valid cross-year sentinel range
    expect(
      validateTrusteeUpcomingKeyDates({
        ...baseInput(),
        tprReviewPeriodStart: '1900-04-01',
        tprReviewPeriodEnd: '1900-03-31',
      }),
    ).toEqual(VALID);
  });

  test('returns VALID when only one side of tprReviewPeriod is a sentinel date (mixed sentinel/full-ISO)', () => {
    // requireChronologicalOrder skips the check when *either* side starts with '1900-',
    // not just when both do -- exercise each side independently.
    expect(
      validateTrusteeUpcomingKeyDates({
        ...baseInput(),
        tprReviewPeriodStart: '1900-09-15',
        tprReviewPeriodEnd: '2025-01-01',
      }),
    ).toEqual(VALID);
    expect(
      validateTrusteeUpcomingKeyDates({
        ...baseInput(),
        tprReviewPeriodStart: '2025-01-01',
        tprReviewPeriodEnd: '1900-03-31',
      }),
    ).toEqual(VALID);
  });

  test('returns error on both fields when tprReviewPeriodStart is after tprReviewPeriodEnd', () => {
    const result = validateTrusteeUpcomingKeyDates({
      ...baseInput(),
      tprReviewPeriodStart: '2026-12-31',
      tprReviewPeriodEnd: '2025-01-01',
    });
    expect(result.valid).toBeFalsy();
    expect(result.reasonMap?.tprReviewPeriodStart?.reasons?.[0]).toBe(
      'TPR Review Period Start must be before TPR Review Period End.',
    );
    expect(result.reasonMap?.tprReviewPeriodEnd?.reasons?.[0]).toBe(
      'TPR Review Period End must be after TPR Review Period Start.',
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

  test('returns error when tirReviewPeriodEnd is set but tirReviewPeriodStart is null', () => {
    const result = validateTrusteeUpcomingKeyDates({
      ...baseInput(),
      tirReviewPeriodStart: null,
      tirReviewPeriodEnd: '1900-06-30',
    });
    expect(result.valid).toBeFalsy();
    expect(result.reasonMap?.tirReviewPeriodStart?.reasons?.[0]).toBe(
      'TIR Review Period Start is required.',
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

  test('returns error when auditCompletionYear is set but auditCompletionStatus is null', () => {
    const result = validateTrusteeUpcomingKeyDates({
      ...baseInput(),
      auditCompletionYear: 2026,
      auditCompletionStatus: null,
    });
    expect(result.valid).toBeFalsy();
    expect(result.reasonMap?.auditCompletionStatus?.reasons?.[0]).toBe(
      'Field Exam/Audit Completion Status is required.',
    );
  });

  test('returns error when auditCompletionStatus is set but auditCompletionYear is null', () => {
    const result = validateTrusteeUpcomingKeyDates({
      ...baseInput(),
      auditCompletionYear: null,
      auditCompletionStatus: 'CLOSED',
    });
    expect(result.valid).toBeFalsy();
    expect(result.reasonMap?.auditCompletionYear?.reasons?.[0]).toBe(
      'Field Exam/Audit Completion Status Year is required.',
    );
  });

  test('returns error when tprCompletionYear is set but tprCompletionStatus is null', () => {
    const result = validateTrusteeUpcomingKeyDates({
      ...baseInput(),
      tprCompletionYear: 2026,
      tprCompletionStatus: null,
    });
    expect(result.valid).toBeFalsy();
    expect(result.reasonMap?.tprCompletionStatus?.reasons?.[0]).toBe(
      'Trustee Performance Review Completion Status is required.',
    );
  });

  test('returns error when tprCompletionStatus is set but tprCompletionYear is null', () => {
    const result = validateTrusteeUpcomingKeyDates({
      ...baseInput(),
      tprCompletionYear: null,
      tprCompletionStatus: 'COMPLETE',
    });
    expect(result.valid).toBeFalsy();
    expect(result.reasonMap?.tprCompletionYear?.reasons?.[0]).toBe(
      'Trustee Performance Review Completion Status Year is required.',
    );
  });

  test('returns error when tirCompletionYear is set but tirCompletionStatus is null', () => {
    const result = validateTrusteeUpcomingKeyDates({
      ...baseInput(),
      tirCompletionYear: 2026,
      tirCompletionStatus: null,
    });
    expect(result.valid).toBeFalsy();
    expect(result.reasonMap?.tirCompletionStatus?.reasons?.[0]).toBe(
      'Trustee Interim Report Completion Status is required.',
    );
  });

  test('returns error when tirCompletionStatus is set but tirCompletionYear is null', () => {
    const result = validateTrusteeUpcomingKeyDates({
      ...baseInput(),
      tirCompletionYear: null,
      tirCompletionStatus: 'COMPLETE',
    });
    expect(result.valid).toBeFalsy();
    expect(result.reasonMap?.tirCompletionYear?.reasons?.[0]).toBe(
      'Trustee Interim Report Completion Status Year is required.',
    );
  });

  test.each([
    [
      'auditCompletionStatus',
      'PENDING',
      'Field Exam/Audit Completion Status must be one of: CLOSED, NOT_CLOSED.',
    ],
    [
      'tprCompletionStatus',
      'PENDING',
      'Trustee Performance Review Completion Status must be one of: COMPLETE, INCOMPLETE.',
    ],
    [
      'tirCompletionStatus',
      'PENDING',
      'Trustee Interim Report Completion Status must be one of: COMPLETE, INCOMPLETE.',
    ],
    [
      'annualReportCompletionStatus',
      'PENDING',
      'Annual Report Completion Status must be one of: COMPLETE, INCOMPLETE.',
    ],
  ])('returns error when %s is set to %s (outside its enum)', (field, value, expectedMessage) => {
    const result = validateTrusteeUpcomingKeyDates({
      ...baseInput(),
      [field]: value,
    });
    expect(result.valid).toBeFalsy();
    expect(result.reasonMap?.[field]?.reasons?.[0]).toBe(expectedMessage);
  });

  test.each([
    ['auditCompletionStatus', 'CLOSED'],
    ['auditCompletionStatus', 'NOT_CLOSED'],
    ['tprCompletionStatus', 'COMPLETE'],
    ['tprCompletionStatus', 'INCOMPLETE'],
    ['tirCompletionStatus', 'COMPLETE'],
    ['tirCompletionStatus', 'INCOMPLETE'],
    ['annualReportCompletionStatus', 'COMPLETE'],
    ['annualReportCompletionStatus', 'INCOMPLETE'],
  ])('returns VALID when %s is set to %s', (field, value) => {
    const yearField = field.replace('Status', 'Year');
    const result = validateTrusteeUpcomingKeyDates({
      ...baseInput(),
      [yearField]: 2026,
      [field]: value,
    });
    expect(result).toEqual(VALID);
  });

  test('returns error when ch13AuditCompletionYear is set but ch13AuditCompletionStatus is null', () => {
    const result = validateTrusteeUpcomingKeyDates({
      ...baseInput(),
      ch13AuditCompletionYear: 2026,
      ch13AuditCompletionStatus: null,
    });
    expect(result.valid).toBeFalsy();
    expect(result.reasonMap?.ch13AuditCompletionStatus?.reasons?.[0]).toBe(
      'Audit Completion Status is required.',
    );
  });

  test('returns error when ch13AuditCompletionStatus is set but ch13AuditCompletionYear is null', () => {
    const result = validateTrusteeUpcomingKeyDates({
      ...baseInput(),
      ch13AuditCompletionYear: null,
      ch13AuditCompletionStatus: 'Complete',
    });
    expect(result.valid).toBeFalsy();
    expect(result.reasonMap?.ch13AuditCompletionYear?.reasons?.[0]).toBe(
      'Audit Completion Year is required.',
    );
  });

  test('returns VALID when ch13AuditCompletionYear and ch13AuditCompletionStatus are both set', () => {
    expect(
      validateTrusteeUpcomingKeyDates({
        ...baseInput(),
        ch13AuditCompletionYear: 2026,
        ch13AuditCompletionStatus: 'Incomplete',
      }),
    ).toEqual(VALID);
  });

  test('returns error when ch13TprCompletionYear is set but ch13TprCompletionStatus is null', () => {
    const result = validateTrusteeUpcomingKeyDates({
      ...baseInput(),
      ch13TprCompletionYear: 2026,
      ch13TprCompletionStatus: null,
    });
    expect(result.valid).toBeFalsy();
    expect(result.reasonMap?.ch13TprCompletionStatus?.reasons?.[0]).toBe(
      'TPR Completion Status is required.',
    );
  });

  test('returns error when ch13TprCompletionStatus is set but ch13TprCompletionYear is null', () => {
    const result = validateTrusteeUpcomingKeyDates({
      ...baseInput(),
      ch13TprCompletionYear: null,
      ch13TprCompletionStatus: 'Complete',
    });
    expect(result.valid).toBeFalsy();
    expect(result.reasonMap?.ch13TprCompletionYear?.reasons?.[0]).toBe(
      'TPR Completion Year is required.',
    );
  });

  test('returns VALID when ch13TprCompletionYear and ch13TprCompletionStatus are both set', () => {
    expect(
      validateTrusteeUpcomingKeyDates({
        ...baseInput(),
        ch13TprCompletionYear: 2026,
        ch13TprCompletionStatus: 'Incomplete',
      }),
    ).toEqual(VALID);
  });

  test.each([
    ['ch13AuditCompletionStatus' as const, 'Audit Completion Status'],
    ['ch13TprCompletionStatus' as const, 'TPR Completion Status'],
  ])('returns error when %s contains a value outside the allowed enum', (field, label) => {
    const result = validateTrusteeUpcomingKeyDates({
      ...baseInput(),
      [field]: 'garbage',
    } as unknown as ReturnType<typeof baseInput>);
    expect(result.valid).toBeFalsy();
    expect(result.reasonMap?.[field]?.reasons?.[0]).toBe(
      `${label} must be one of: Complete, Incomplete.`,
    );
  });

  test.each([
    ['ch13AuditCompletionStatus' as const, 'Complete'],
    ['ch13AuditCompletionStatus' as const, 'Incomplete'],
    ['ch13TprCompletionStatus' as const, 'Complete'],
    ['ch13TprCompletionStatus' as const, 'Incomplete'],
  ])('returns VALID when %s is %s', (field, value) => {
    const yearField =
      field === 'ch13AuditCompletionStatus' ? 'ch13AuditCompletionYear' : 'ch13TprCompletionYear';
    expect(
      validateTrusteeUpcomingKeyDates({
        ...baseInput(),
        [field]: value,
        [yearField]: 2026,
      }),
    ).toEqual(VALID);
  });

  test.each([
    ['ch13AuditCompletionYear' as const, 'ch13AuditCompletionStatus' as const, 1900],
    ['ch13AuditCompletionYear' as const, 'ch13AuditCompletionStatus' as const, 2100],
    ['ch13TprCompletionYear' as const, 'ch13TprCompletionStatus' as const, 1900],
    ['ch13TprCompletionYear' as const, 'ch13TprCompletionStatus' as const, 2100],
  ])('returns VALID when %s is the inclusive boundary value %i', (field, statusField, year) => {
    expect(
      validateTrusteeUpcomingKeyDates({
        ...baseInput(),
        [field]: year,
        [statusField]: 'Complete',
      }),
    ).toEqual(VALID);
  });

  test.each([
    ['ch13AuditCompletionYear' as const, 'Audit Completion Year'],
    ['ch13TprCompletionYear' as const, 'TPR Completion Year'],
  ])('returns error when %s is below the allowed range', (field, label) => {
    const statusField =
      field === 'ch13AuditCompletionYear' ? 'ch13AuditCompletionStatus' : 'ch13TprCompletionStatus';
    const result = validateTrusteeUpcomingKeyDates({
      ...baseInput(),
      [field]: 1899,
      [statusField]: 'Complete',
    });
    expect(result.valid).toBeFalsy();
    expect(result.reasonMap?.[field]?.reasons?.[0]).toBe(
      `${label} must be a whole number between 1900 and 2100.`,
    );
  });

  test.each([
    ['ch13AuditCompletionYear' as const, 'Audit Completion Year'],
    ['ch13TprCompletionYear' as const, 'TPR Completion Year'],
  ])('returns error when %s is above the allowed range', (field, label) => {
    const statusField =
      field === 'ch13AuditCompletionYear' ? 'ch13AuditCompletionStatus' : 'ch13TprCompletionStatus';
    const result = validateTrusteeUpcomingKeyDates({
      ...baseInput(),
      [field]: 2101,
      [statusField]: 'Complete',
    });
    expect(result.valid).toBeFalsy();
    expect(result.reasonMap?.[field]?.reasons?.[0]).toBe(
      `${label} must be a whole number between 1900 and 2100.`,
    );
  });

  test.each([
    ['ch13AuditCompletionYear' as const, 'Audit Completion Year'],
    ['ch13TprCompletionYear' as const, 'TPR Completion Year'],
  ])('returns error when %s is not an integer', (field, label) => {
    const statusField =
      field === 'ch13AuditCompletionYear' ? 'ch13AuditCompletionStatus' : 'ch13TprCompletionStatus';
    const result = validateTrusteeUpcomingKeyDates({
      ...baseInput(),
      [field]: 2025.5,
      [statusField]: 'Complete',
    });
    expect(result.valid).toBeFalsy();
    expect(result.reasonMap?.[field]?.reasons?.[0]).toBe(
      `${label} must be a whole number between 1900 and 2100.`,
    );
  });

  test.each([
    ['ch13AuditCompletionYear' as const, 'Audit Completion Year'],
    ['ch13TprCompletionYear' as const, 'TPR Completion Year'],
  ])('returns error when %s is a non-number value (defensive type guard)', (field, label) => {
    const statusField =
      field === 'ch13AuditCompletionYear' ? 'ch13AuditCompletionStatus' : 'ch13TprCompletionStatus';
    const result = validateTrusteeUpcomingKeyDates({
      ...baseInput(),
      [field]: 'garbage',
      [statusField]: 'Complete',
    } as unknown as ReturnType<typeof baseInput>);
    expect(result.valid).toBeFalsy();
    expect(result.reasonMap?.[field]?.reasons?.[0]).toBe(
      `${label} must be a whole number between 1900 and 2100.`,
    );
  });

  test.each([['ch13AuditCompletionYear' as const], ['ch13TprCompletionYear' as const]])(
    'returns VALID when %s is null',
    (field) => {
      expect(
        validateTrusteeUpcomingKeyDates({
          ...baseInput(),
          [field]: null,
        }),
      ).toEqual(VALID);
    },
  );

  test('returns error when a sentinel date field contains an invalid ISO date', () => {
    const result = validateTrusteeUpcomingKeyDates({
      ...baseInput(),
      tprDue: '1900-02-30',
    });
    expect(result.valid).toBeFalsy();
    expect(result.reasonMap?.tprDue?.reasons?.[0]).toBe('Must be a valid date mm/dd.');
  });

  test.each([
    ['tirReviewPeriodStart'],
    ['tirReviewPeriodEnd'],
    ['tirSubmission'],
    ['tirReview'],
    ['tirSemiAnnualReviewPeriodStart'],
    ['tirSemiAnnualReviewPeriodEnd'],
  ])('returns error when %s contains an invalid ISO date', (field) => {
    const result = validateTrusteeUpcomingKeyDates({
      ...baseInput(),
      [field]: '1900-02-30',
    });
    expect(result.valid).toBeFalsy();
    expect(result.reasonMap?.[field]?.reasons?.[0]).toBe('Must be a valid date mm/dd.');
  });

  test.each([
    ['pastFieldExam'],
    ['tprReviewPeriodStart'],
    ['tprReviewPeriodEnd'],
    ['lastTprSubmitted'],
  ])('returns error when %s (full date field) contains an invalid ISO date', (field) => {
    const result = validateTrusteeUpcomingKeyDates({
      ...baseInput(),
      [field]: '2026-13-01',
    });
    expect(result.valid).toBeFalsy();
    expect(result.reasonMap?.[field]?.reasons?.[0]).toBe('Must be a valid date mm/dd/yyyy.');
  });

  test('returns VALID when pastBackgroundQuestion is a valid full date', () => {
    expect(
      validateTrusteeUpcomingKeyDates({ ...baseInput(), pastBackgroundQuestion: '2023-04-10' }),
    ).toEqual(VALID);
  });

  test('returns error when pastBackgroundQuestion contains an invalid ISO date', () => {
    const result = validateTrusteeUpcomingKeyDates({
      ...baseInput(),
      pastBackgroundQuestion: '2026-13-01',
    });
    expect(result.valid).toBeFalsy();
    expect(result.reasonMap?.pastBackgroundQuestion?.reasons?.[0]).toBe(
      'Must be a valid date mm/dd/yyyy.',
    );
  });

  test('returns VALID when pastTprSubmission is a valid full date', () => {
    expect(
      validateTrusteeUpcomingKeyDates({ ...baseInput(), pastTprSubmission: '2023-04-10' }),
    ).toEqual(VALID);
  });

  test('returns VALID when lastTprSubmitted is a valid full date', () => {
    expect(
      validateTrusteeUpcomingKeyDates({ ...baseInput(), lastTprSubmitted: '2023-04-10' }),
    ).toEqual(VALID);
  });

  test('returns error when pastTprSubmission contains an invalid ISO date', () => {
    const result = validateTrusteeUpcomingKeyDates({
      ...baseInput(),
      pastTprSubmission: '2026-13-01',
    });
    expect(result.valid).toBeFalsy();
    expect(result.reasonMap?.pastTprSubmission?.reasons?.[0]).toBe(
      'Must be a valid date mm/dd/yyyy.',
    );
  });

  test('returns VALID when lastMonthlyReportReceived is a valid full date', () => {
    expect(
      validateTrusteeUpcomingKeyDates({
        ...baseInput(),
        lastMonthlyReportReceived: '2024-11-15',
      }),
    ).toEqual(VALID);
  });

  test('returns error when lastMonthlyReportReceived contains an invalid ISO date', () => {
    const result = validateTrusteeUpcomingKeyDates({
      ...baseInput(),
      lastMonthlyReportReceived: '2024-13-01',
    });
    expect(result.valid).toBeFalsy();
    expect(result.reasonMap?.lastMonthlyReportReceived?.reasons?.[0]).toBe(
      'Must be a valid date mm/dd/yyyy.',
    );
  });

  test('returns VALID when tirSemiAnnualReviewPeriodStart and tirSemiAnnualReviewPeriodEnd are both set', () => {
    expect(
      validateTrusteeUpcomingKeyDates({
        ...baseInput(),
        tirSemiAnnualReviewPeriodStart: '1900-07-01',
        tirSemiAnnualReviewPeriodEnd: '1900-12-31',
      }),
    ).toEqual(VALID);
  });

  test('returns error when tirSemiAnnualReviewPeriodStart set but tirSemiAnnualReviewPeriodEnd is null', () => {
    const result = validateTrusteeUpcomingKeyDates({
      ...baseInput(),
      tirSemiAnnualReviewPeriodStart: '1900-07-01',
      tirSemiAnnualReviewPeriodEnd: null,
    });
    expect(result.valid).toBeFalsy();
    expect(result.reasonMap?.tirSemiAnnualReviewPeriodEnd?.reasons?.[0]).toBe(
      'TIR Review Period 2 End is required.',
    );
  });

  test('returns error when tirSemiAnnualReviewPeriodEnd set but tirSemiAnnualReviewPeriodStart is null', () => {
    const result = validateTrusteeUpcomingKeyDates({
      ...baseInput(),
      tirSemiAnnualReviewPeriodStart: null,
      tirSemiAnnualReviewPeriodEnd: '1900-12-31',
    });
    expect(result.valid).toBeFalsy();
    expect(result.reasonMap?.tirSemiAnnualReviewPeriodStart?.reasons?.[0]).toBe(
      'TIR Review Period 2 Start is required.',
    );
  });

  test('returns error when tirSemiAnnualSubmission is an invalid sentinel date', () => {
    const result = validateTrusteeUpcomingKeyDates({
      ...baseInput(),
      tirSemiAnnualSubmission: '1900-02-30',
    });
    expect(result.valid).toBeFalsy();
    expect(result.reasonMap?.tirSemiAnnualSubmission?.reasons?.[0]).toBe(
      'Must be a valid date mm/dd.',
    );
  });

  test('returns error when tirSemiAnnualReview is an invalid sentinel date', () => {
    const result = validateTrusteeUpcomingKeyDates({
      ...baseInput(),
      tirSemiAnnualReview: '1900-13-01',
    });
    expect(result.valid).toBeFalsy();
    expect(result.reasonMap?.tirSemiAnnualReview?.reasons?.[0]).toBe('Must be a valid date mm/dd.');
  });

  test('returns VALID when leaseExpiration is a valid full date', () => {
    expect(
      validateTrusteeUpcomingKeyDates({ ...baseInput(), leaseExpiration: '2027-06-30' }),
    ).toEqual(VALID);
  });

  test('returns error when leaseExpiration contains an invalid ISO date', () => {
    const result = validateTrusteeUpcomingKeyDates({
      ...baseInput(),
      leaseExpiration: '2027-13-01',
    });
    expect(result.valid).toBeFalsy();
    expect(result.reasonMap?.leaseExpiration?.reasons?.[0]).toBe(
      'Must be a valid date mm/dd/yyyy.',
    );
  });

  test('returns VALID when idExpiration is a valid full date', () => {
    expect(validateTrusteeUpcomingKeyDates({ ...baseInput(), idExpiration: '2028-01-15' })).toEqual(
      VALID,
    );
  });

  test('returns error when idExpiration contains an invalid ISO date', () => {
    const result = validateTrusteeUpcomingKeyDates({
      ...baseInput(),
      idExpiration: '2028-00-15',
    });
    expect(result.valid).toBeFalsy();
    expect(result.reasonMap?.idExpiration?.reasons?.[0]).toBe('Must be a valid date mm/dd/yyyy.');
  });

  test('returns VALID when pastAudit is a valid full date', () => {
    expect(validateTrusteeUpcomingKeyDates({ ...baseInput(), pastAudit: '2024-03-15' })).toEqual(
      VALID,
    );
  });

  test('returns error when pastAudit contains an invalid ISO date', () => {
    const result = validateTrusteeUpcomingKeyDates({
      ...baseInput(),
      pastAudit: '2024-13-01',
    });
    expect(result.valid).toBeFalsy();
    expect(result.reasonMap?.pastAudit?.reasons?.[0]).toBe('Must be a valid date mm/dd/yyyy.');
  });

  test('returns VALID when lastCompensationStudy is a valid full date', () => {
    expect(
      validateTrusteeUpcomingKeyDates({ ...baseInput(), lastCompensationStudy: '2024-06-01' }),
    ).toEqual(VALID);
  });

  test('returns error when lastCompensationStudy contains an invalid ISO date', () => {
    const result = validateTrusteeUpcomingKeyDates({
      ...baseInput(),
      lastCompensationStudy: '2024-13-01',
    });
    expect(result.valid).toBeFalsy();
    expect(result.reasonMap?.lastCompensationStudy?.reasons?.[0]).toBe(
      'Must be a valid date mm/dd/yyyy.',
    );
  });

  test('returns VALID when bondIssuedDate is a valid full date', () => {
    expect(
      validateTrusteeUpcomingKeyDates({ ...baseInput(), bondIssuedDate: '2023-06-01' }),
    ).toEqual(VALID);
  });

  test('returns error when bondIssuedDate contains an invalid ISO date', () => {
    const result = validateTrusteeUpcomingKeyDates({
      ...baseInput(),
      bondIssuedDate: '2023-13-01',
    });
    expect(result.valid).toBeFalsy();
    expect(result.reasonMap?.bondIssuedDate?.reasons?.[0]).toBe('Must be a valid date mm/dd/yyyy.');
  });

  test('returns VALID when bondRenewalDate is a valid full date', () => {
    expect(
      validateTrusteeUpcomingKeyDates({ ...baseInput(), bondRenewalDate: '2026-06-01' }),
    ).toEqual(VALID);
  });

  test('returns error when bondRenewalDate contains an invalid ISO date', () => {
    const result = validateTrusteeUpcomingKeyDates({
      ...baseInput(),
      bondRenewalDate: '2026-00-01',
    });
    expect(result.valid).toBeFalsy();
    expect(result.reasonMap?.bondRenewalDate?.reasons?.[0]).toBe(
      'Must be a valid date mm/dd/yyyy.',
    );
  });

  test('DATE_FIELDS contains the exact set of expected fields', () => {
    expect(DATE_FIELDS).toEqual([
      'pastBackgroundQuestion',
      'pastFieldExam',
      'pastAudit',
      'pastTprSubmission',
      'lastTprSubmitted',
      'tprReviewPeriodStart',
      'tprReviewPeriodEnd',
      'tprDue',
      'tirReviewPeriodStart',
      'tirReviewPeriodEnd',
      'tirSubmission',
      'tirReview',
      'tirSemiAnnualReviewPeriodStart',
      'tirSemiAnnualReviewPeriodEnd',
      'tirSemiAnnualSubmission',
      'tirSemiAnnualReview',
      'lastMonthlyReportReceived',
      'leaseExpiration',
      'idExpiration',
      'lastCompensationStudy',
      'bondIssuedDate',
      'bondRenewalDate',
    ]);
  });

  test('TEXT_FIELDS contains the exact set of expected fields', () => {
    expect(TEXT_FIELDS).toEqual([
      'tprDueYearType',
      'tprFrequency',
      'tirFrequency',
      'auditCompletionStatus',
      'tprCompletionStatus',
      'tirCompletionStatus',
      'annualReportCompletionStatus',
      'ch13AuditCompletionStatus',
      'ch13TprCompletionStatus',
    ]);
  });

  test('SCALAR_FIELDS contains the exact set of expected fields', () => {
    expect(SCALAR_FIELDS).toEqual([
      'lastAuditFiscalYear',
      'upcomingExamOrAuditYear',
      'upcomingExamOrAuditType',
      'auditCompletionYear',
      'tprCompletionYear',
      'tirCompletionYear',
      'annualReportCompletionYear',
      'ch13AuditCompletionYear',
      'ch13TprCompletionYear',
    ]);
  });

  test('every input field is routed to a field list', () => {
    // The use case builds the saved document and the audit diff by iterating
    // these lists, so a field that reaches none of them is silently never
    // persisted and never audited. Asserting the lists' exact contents only
    // catches edits to the lists; asserting them against the input type
    // catches the field that was added to the model and forgotten here.
    const routed = new Set<string>([...DATE_FIELDS, ...TEXT_FIELDS, ...SCALAR_FIELDS]);

    const unrouted = Object.keys(baseInput()).filter(
      (field) => field !== 'trusteeId' && field !== 'appointmentId' && !routed.has(field),
    );

    expect(unrouted).toEqual([]);
  });
});

describe('validateTprDuePair', () => {
  test.each([
    ['', '', 'both are empty'],
    [null, null, 'both are null'],
    [undefined, undefined, 'both are undefined'],
    ['1900-09-15', 'EVEN', 'both tprDue and tprDueYearType are valid'],
  ])('returns empty string when %s', (tprDue, tprDueYearType, _desc) => {
    expect(validateTprDuePair(tprDue, tprDueYearType)).toBe('');
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

describe('validateCompletionPairPresence', () => {
  test('returns empty string when both year and status are set', () => {
    expect(validateCompletionPairPresence(2026, 'COMPLETE', 'Some Label')).toBe('');
  });

  test('returns empty string when both are empty strings', () => {
    expect(validateCompletionPairPresence('', '', 'Some Label')).toBe('');
  });

  test('returns empty string when both are null', () => {
    expect(validateCompletionPairPresence(null, null, 'Some Label')).toBe('');
  });

  test('returns empty string when both are undefined', () => {
    expect(validateCompletionPairPresence(undefined, undefined, 'Some Label')).toBe('');
  });

  test('returns an error when year is set but status is blank', () => {
    expect(validateCompletionPairPresence(2026, '', 'Some Label')).toBe(
      'Some Label Year and Status must both be set.',
    );
  });

  test('returns an error when status is set but year is blank', () => {
    expect(validateCompletionPairPresence('', 'COMPLETE', 'Some Label')).toBe(
      'Some Label Year and Status must both be set.',
    );
  });

  test('uses custom field names in the error message when provided', () => {
    expect(
      validateCompletionPairPresence(2026, '', 'Field Exam or Audit', {
        first: 'Year',
        second: 'Type',
      }),
    ).toBe('Field Exam or Audit Year and Type must both be set.');
  });

  test('supports string values for the first field with custom field names', () => {
    expect(
      validateCompletionPairPresence('ANNUAL', '', 'Trustee Interim Report (TIR) Period', {
        first: 'Frequency',
        second: 'Period',
      }),
    ).toBe('Trustee Interim Report (TIR) Period Frequency and Period must both be set.');
  });
});

describe('validateTprReviewPeriodOrder', () => {
  test('returns null when both values are empty', () => {
    expect(validateTprReviewPeriodOrder('', '')).toBeNull();
  });

  test('returns null when start is empty', () => {
    expect(validateTprReviewPeriodOrder('', '2026-06-30')).toBeNull();
  });

  test('returns null when end is empty', () => {
    expect(validateTprReviewPeriodOrder('2026-01-01', '')).toBeNull();
  });

  test('returns null when start equals end', () => {
    expect(validateTprReviewPeriodOrder('2026-01-01', '2026-01-01')).toBeNull();
  });

  test('returns null when start is before end', () => {
    expect(validateTprReviewPeriodOrder('2026-01-01', '2026-12-31')).toBeNull();
  });

  test('returns null for sentinel dates regardless of order', () => {
    expect(validateTprReviewPeriodOrder('1900-12-01', '1900-03-31')).toBeNull();
  });

  test('returns per-field errors when start is after end', () => {
    expect(validateTprReviewPeriodOrder('2026-12-31', '2026-01-01')).toEqual({
      startError: 'TPR Review Period Start must be before TPR Review Period End.',
      endError: 'TPR Review Period End must be after TPR Review Period Start.',
    });
  });
});

describe('calculateAuditReqBy', () => {
  test.each([
    [null, null],
    [undefined, null],
  ])('returns null when input is %s', (input, expected) => {
    expect(calculateAuditReqBy(input)).toBe(expected);
  });

  test.each([
    [2024, 2027],
    [2022, 2025],
    [2020, 2023],
    [2021, 2024],
  ])('returns %i + 3 = %i', (input, expected) => {
    expect(calculateAuditReqBy(input)).toBe(expected);
  });
});

describe('trustee-upcoming-key-dates - mutation gap tests', () => {
  describe('isoToSentinel', () => {
    test('converts a full ISO date to sentinel format', () => {
      expect(isoToSentinel('2025-06-30')).toBe('1900-06-30');
    });

    test('returns empty string for empty input', () => {
      expect(isoToSentinel('')).toBe('');
    });

    test('returns empty string for input without enough parts', () => {
      expect(isoToSentinel('2025-06')).toBe('');
    });

    test('preserves zero-padded month and day', () => {
      expect(isoToSentinel('2024-03-05')).toBe('1900-03-05');
    });
  });
});

describe('calculateTprDueYear', () => {
  test.each([
    ['EVEN', 2026, 2026],
    ['ODD', 2026, 2027],
    ['ODD', 2027, 2027],
    ['EVEN', 2027, 2028],
    ['EVEN', 2025, 2026],
    ['ODD', 2025, 2025],
    ['EVEN', 2024, 2024],
    ['ODD', 2024, 2025],
  ] as const)('calculateTprDueYear(%s, %d) -> %d', (yearType, currentYear, expected) => {
    expect(calculateTprDueYear(yearType, currentYear)).toBe(expected);
  });
});
