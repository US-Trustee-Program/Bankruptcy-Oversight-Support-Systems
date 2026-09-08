import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { UPCOMING_KEY_DATES_FIELD_CONFIG } from './upcomingKeyDatesFieldConfig';
import { TrusteeUpcomingKeyDates } from '@common/cams/trustee-upcoming-key-dates';
import { SYSTEM_USER_REFERENCE } from '@common/cams/auditable';

const baseDoc: TrusteeUpcomingKeyDates = {
  id: 'doc-1',
  documentType: 'TRUSTEE_UPCOMING_REPORT_DATES',
  trusteeId: 'trustee-1',
  appointmentId: 'appt-1',
  createdBy: SYSTEM_USER_REFERENCE,
  createdOn: '2026-01-01T00:00:00.000Z',
  updatedBy: SYSTEM_USER_REFERENCE,
  updatedOn: '2026-01-01T00:00:00.000Z',
};

describe('UPCOMING_KEY_DATES_FIELD_CONFIG chapter13-standing variant', () => {
  const config = UPCOMING_KEY_DATES_FIELD_CONFIG['chapter13-standing'];

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-15'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test('has 7 entries', () => {
    expect(config).toHaveLength(7);
  });

  test('first field is Annual Audit Review Period constant 10/01 - 09/30', () => {
    const field = config.find((f) => f.key === 'annualAuditReviewPeriod');
    expect(field?.kind).toBe('constant');
    if (field?.kind === 'constant') {
      expect(field.displayLabel).toBe('Annual Audit Review Period');
      expect(field.value).toBe('10/01 - 09/30');
      expect(field.testId).toBe('annual-audit-review-period-row');
    }
  });

  test('Budget Submission Due constant is 07/01', () => {
    const field = config.find((f) => f.key === 'budgetSubmissionDue');
    expect(field?.kind).toBe('constant');
    if (field?.kind === 'constant') {
      expect(field.displayLabel).toBe('Budget Submission Due');
      expect(field.value).toBe('07/01');
    }
  });

  test('Budget Review to OO constant is 08/15', () => {
    const field = config.find((f) => f.key === 'budgetReviewToOO');
    expect(field?.kind).toBe('constant');
    if (field?.kind === 'constant') {
      expect(field.displayLabel).toBe('Budget Review to OO');
      expect(field.value).toBe('08/15');
    }
  });

  test.each([
    [
      'tprReviewPeriod',
      'TPR Review Period',
      { tprReviewPeriodStart: '1900-04-01', tprReviewPeriodEnd: '1900-03-31' },
      '04/01 - 03/31',
    ],
    ['tprDue', 'TPR Due', { tprDue: '1900-06-15', tprDueYearType: 'EVEN' }, '06/15/2026'],
  ])(
    '%s computed field has label "%s" and correct null/value output',
    (key, expectedLabel, dataOverride, expectedValue) => {
      const field = config.find((f) => f.key === key);
      expect(field?.kind).toBe('computed');
      if (field?.kind === 'computed') {
        const nullResult = field.buildField(null);
        expect(nullResult.label).toBe(expectedLabel);
        expect(nullResult.value).toBe('No date added');

        const valueResult = field.buildField({ ...baseDoc, ...(dataOverride as object) });
        expect(valueResult.label).toBe(expectedLabel);
        expect(valueResult.value).toBe(expectedValue);
      }
    },
  );

  test('leaseExpiration computed shows No date added when data is null', () => {
    const field = config.find((f) => f.key === 'leaseExpiration');
    expect(field?.kind).toBe('computed');
    if (field?.kind === 'computed') {
      const result = field.buildField(null);
      expect(result.label).toBe('Lease Expiration');
      expect(result.value).toBe('No date added');
    }
  });

  test('leaseExpiration computed shows MM/DD/YYYY when data is set', () => {
    const field = config.find((f) => f.key === 'leaseExpiration');
    expect(field?.kind).toBe('computed');
    if (field?.kind === 'computed') {
      const result = field.buildField({ ...baseDoc, leaseExpiration: '2027-06-30' });
      expect(result.value).toBe('06/30/2027');
    }
  });

  test('idExpiration computed shows No date added when data is null', () => {
    const field = config.find((f) => f.key === 'idExpiration');
    expect(field?.kind).toBe('computed');
    if (field?.kind === 'computed') {
      const result = field.buildField(null);
      expect(result.label).toBe('ID Expiration');
      expect(result.value).toBe('No date added');
    }
  });

  test('idExpiration computed shows MM/DD/YYYY when data is set', () => {
    const field = config.find((f) => f.key === 'idExpiration');
    expect(field?.kind).toBe('computed');
    if (field?.kind === 'computed') {
      const result = field.buildField({ ...baseDoc, idExpiration: '2028-12-31' });
      expect(result.value).toBe('12/31/2028');
    }
  });

  test('tprDue shows year+1 when year type is ODD and current year is even (2026)', () => {
    const field = config.find((f) => f.key === 'tprDue');
    expect(field?.kind).toBe('computed');
    if (field?.kind === 'computed') {
      const result = field.buildField({ ...baseDoc, tprDue: '1900-06-15', tprDueYearType: 'ODD' });
      expect(result.value).toBe('06/15/2027');
    }
  });
});

describe('UPCOMING_KEY_DATES_FIELD_CONFIG tprDue across variants — pinned to 2026 (even)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-15'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test.each([
    ['chapter7-panel', 'Trustee Performance Review Due'],
    ['ch12-13-case-by-case', 'Trustee Performance Review Due'],
    ['chapter12-standing', 'Trustee Performance Review Due'],
  ] as const)('%s tprDue shows mm/dd/yyyy (EVEN type in 2026 → 2026)', (variant, expectedLabel) => {
    const config = UPCOMING_KEY_DATES_FIELD_CONFIG[variant];
    const field = config.find((f) => f.key === 'tprDue');
    expect(field?.kind).toBe('computed');
    if (field?.kind === 'computed') {
      const nullResult = field.buildField(null);
      expect(nullResult.label).toBe(expectedLabel);
      expect(nullResult.value).toBe('No date added');

      const valueResult = field.buildField({
        ...baseDoc,
        tprDue: '1900-06-15',
        tprDueYearType: 'EVEN',
      });
      expect(valueResult.value).toBe('06/15/2026');

      const oddResult = field.buildField({
        ...baseDoc,
        tprDue: '1900-06-15',
        tprDueYearType: 'ODD',
      });
      expect(oddResult.value).toBe('06/15/2027');
    }
  });
});

describe('UPCOMING_KEY_DATES_FIELD_CONFIG tprDue — pinned to 2027 (odd)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2027-01-15'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test('chapter13-standing tprDue: ODD type in 2027 → 2027', () => {
    const config = UPCOMING_KEY_DATES_FIELD_CONFIG['chapter13-standing'];
    const field = config.find((f) => f.key === 'tprDue');
    expect(field?.kind).toBe('computed');
    if (field?.kind === 'computed') {
      const result = field.buildField({ ...baseDoc, tprDue: '1900-03-01', tprDueYearType: 'ODD' });
      expect(result.value).toBe('03/01/2027');
    }
  });

  test('chapter13-standing tprDue: EVEN type in 2027 → 2028', () => {
    const config = UPCOMING_KEY_DATES_FIELD_CONFIG['chapter13-standing'];
    const field = config.find((f) => f.key === 'tprDue');
    expect(field?.kind).toBe('computed');
    if (field?.kind === 'computed') {
      const result = field.buildField({
        ...baseDoc,
        tprDue: '1900-03-01',
        tprDueYearType: 'EVEN',
      });
      expect(result.value).toBe('03/01/2028');
    }
  });
});
