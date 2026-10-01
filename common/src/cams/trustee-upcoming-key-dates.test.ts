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
  DATE_FIELDS,
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
      ['1900-01-30', '1900-02-29', 'crosses Feb 29 correctly (leap-year arithmetic for day math)'],
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
      ['1900-01-01', '1900-03-01'],
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
        '2025-01-15',
        undefined,
        3,
        '2028-03-01',
        'January date aligns to March 31 quarter end via month < quarter-end month',
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
      lastMonthlyReportReceived: null,
      leaseExpiration: null,
      idExpiration: null,
      lastCompensationStudy: null,
      bondIssuedDate: null,
      bondRenewalDate: null,
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

  test.each([
    {
      label: 'tprReviewPeriod',
      startField: 'tprReviewPeriodStart' as const,
      endField: 'tprReviewPeriodEnd' as const,
      startValue: '1900-04-01',
      endValue: '1900-03-31',
      startLabel: 'TPR Review Period Start',
      endLabel: 'TPR Review Period End',
    },
    {
      label: 'tirReviewPeriod',
      startField: 'tirReviewPeriodStart' as const,
      endField: 'tirReviewPeriodEnd' as const,
      startValue: '1900-07-01',
      endValue: '1900-06-30',
      startLabel: 'TIR Review Period Start',
      endLabel: 'TIR Review Period End',
    },
    {
      label: 'tirSemiAnnualReviewPeriod',
      startField: 'tirSemiAnnualReviewPeriodStart' as const,
      endField: 'tirSemiAnnualReviewPeriodEnd' as const,
      startValue: '1900-07-01',
      endValue: '1900-12-31',
      startLabel: 'TIR Review Period 2 Start',
      endLabel: 'TIR Review Period 2 End',
    },
  ])(
    'returns error when only one side of $label is set (the missing side is required)',
    ({ startField, endField, startValue, endValue, startLabel, endLabel }) => {
      const startOnly = validateTrusteeUpcomingKeyDates({
        ...baseInput(),
        [startField]: startValue,
        [endField]: null,
      });
      expect(startOnly.valid).toBeFalsy();
      expect(startOnly.reasonMap?.[endField]?.reasons?.[0]).toBe(`${endLabel} is required.`);

      const endOnly = validateTrusteeUpcomingKeyDates({
        ...baseInput(),
        [startField]: null,
        [endField]: endValue,
      });
      expect(endOnly.valid).toBeFalsy();
      expect(endOnly.reasonMap?.[startField]?.reasons?.[0]).toBe(`${startLabel} is required.`);
    },
  );

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

  test('returns VALID when only tprReviewPeriodStart is sentinel-format', () => {
    // Either side being sentinel-format skips the chronological check entirely, even
    // when the other side is a full ISO date that would otherwise fail the comparison.
    expect(
      validateTrusteeUpcomingKeyDates({
        ...baseInput(),
        tprReviewPeriodStart: '1900-04-01',
        tprReviewPeriodEnd: '2025-03-31',
      }),
    ).toEqual(VALID);
  });

  test('returns VALID when only tprReviewPeriodEnd is sentinel-format', () => {
    // Mirrors the case above from the other side of the OR condition: a full ISO start
    // that would otherwise fail the "before end" comparison is skipped because the end
    // is sentinel-format.
    expect(
      validateTrusteeUpcomingKeyDates({
        ...baseInput(),
        tprReviewPeriodStart: '2025-04-01',
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

  test.each([['pastFieldExam'], ['tprReviewPeriodStart'], ['tprReviewPeriodEnd']])(
    'returns error when %s (full date field) contains an invalid ISO date',
    (field) => {
      const result = validateTrusteeUpcomingKeyDates({
        ...baseInput(),
        [field]: '2026-13-01',
      });
      expect(result.valid).toBeFalsy();
      expect(result.reasonMap?.[field]?.reasons?.[0]).toBe('Must be a valid date mm/dd/yyyy.');
    },
  );

  test.each([
    ['pastBackgroundQuestion', '2023-04-10', '2026-13-01'],
    ['pastTprSubmission', '2023-04-10', '2026-13-01'],
    ['lastMonthlyReportReceived', '2024-11-15', '2024-13-01'],
  ] as const)(
    'returns VALID/error for %s full date validation',
    (field, validValue, invalidValue) => {
      expect(validateTrusteeUpcomingKeyDates({ ...baseInput(), [field]: validValue })).toEqual(
        VALID,
      );

      const result = validateTrusteeUpcomingKeyDates({ ...baseInput(), [field]: invalidValue });
      expect(result.valid).toBeFalsy();
      expect(result.reasonMap?.[field]?.reasons?.[0]).toBe('Must be a valid date mm/dd/yyyy.');
    },
  );

  test('returns VALID when tirSemiAnnualReviewPeriodStart and tirSemiAnnualReviewPeriodEnd are both set', () => {
    expect(
      validateTrusteeUpcomingKeyDates({
        ...baseInput(),
        tirSemiAnnualReviewPeriodStart: '1900-07-01',
        tirSemiAnnualReviewPeriodEnd: '1900-12-31',
      }),
    ).toEqual(VALID);
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

  test.each([
    ['leaseExpiration', '2027-06-30', '2027-13-01'],
    ['idExpiration', '2028-01-15', '2028-00-15'],
    ['pastAudit', '2024-03-15', '2024-13-01'],
    ['lastCompensationStudy', '2024-06-01', '2024-13-01'],
    ['bondIssuedDate', '2023-06-01', '2023-13-01'],
    ['bondRenewalDate', '2026-06-01', '2026-00-01'],
  ] as const)(
    'returns VALID/error for %s full date validation',
    (field, validValue, invalidValue) => {
      expect(validateTrusteeUpcomingKeyDates({ ...baseInput(), [field]: validValue })).toEqual(
        VALID,
      );

      const result = validateTrusteeUpcomingKeyDates({ ...baseInput(), [field]: invalidValue });
      expect(result.valid).toBeFalsy();
      expect(result.reasonMap?.[field]?.reasons?.[0]).toBe('Must be a valid date mm/dd/yyyy.');
    },
  );

  test('DATE_FIELDS contains the exact set of expected fields', () => {
    // Order is not semantically meaningful to either consumer (both iterate/filter without
    // relying on position), so compare as sets rather than locking in array order.
    expect(new Set(DATE_FIELDS)).toEqual(
      new Set([
        'pastBackgroundQuestion',
        'pastFieldExam',
        'pastAudit',
        'pastTprSubmission',
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
      ]),
    );
    expect(DATE_FIELDS).toHaveLength(21);
  });

  test('TEXT_FIELDS contains the exact set of expected fields', () => {
    expect(new Set(TEXT_FIELDS)).toEqual(
      new Set(['tprDueYearType', 'tprFrequency', 'tirFrequency']),
    );
    expect(TEXT_FIELDS).toHaveLength(3);
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
