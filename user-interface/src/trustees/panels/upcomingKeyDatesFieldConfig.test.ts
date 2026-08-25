import { describe, test, expect } from 'vitest';
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

  test('has 7 entries', () => {
    expect(config).toHaveLength(7);
  });

  test('first field is Annual Audit Review Period constant 10/01 - 09/30', () => {
    const field = config[0];
    expect(field.kind).toBe('constant');
    if (field.kind === 'constant') {
      expect(field.displayLabel).toBe('Annual Audit Review Period');
      expect(field.value).toBe('10/01 - 09/30');
      expect(field.testId).toBe('annual-audit-review-period-row');
    }
  });

  test('Budget Submission Due constant is 07/01', () => {
    const field = config[4];
    expect(field.kind).toBe('constant');
    if (field.kind === 'constant') {
      expect(field.displayLabel).toBe('Budget Submission Due');
      expect(field.value).toBe('07/01');
    }
  });

  test('Budget Review to OO constant is 08/15', () => {
    const field = config[5];
    expect(field.kind).toBe('constant');
    if (field.kind === 'constant') {
      expect(field.displayLabel).toBe('Budget Review to OO');
      expect(field.value).toBe('08/15');
    }
  });

  test.each([
    [
      'tprReviewPeriod',
      1,
      'TPR Review Period',
      { tprReviewPeriodStart: '1900-04-01', tprReviewPeriodEnd: '1900-03-31' },
      '04/01 - 03/31',
    ],
    ['tprDue', 2, 'TPR Due', { tprDue: '1900-06-15', tprDueYearType: 'EVEN' }, '06/15 EVEN'],
  ])(
    '%s computed field has label "%s" and correct null/value output',
    (_key, index, expectedLabel, dataOverride, expectedValue) => {
      const field = config[index as number];
      expect(field.kind).toBe('computed');
      if (field.kind === 'computed') {
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
    const field = config[3];
    expect(field.kind).toBe('computed');
    if (field.kind === 'computed') {
      const result = field.buildField(null);
      expect(result.label).toBe('Lease Expiration');
      expect(result.value).toBe('No date added');
    }
  });

  test('leaseExpiration computed shows MM/DD/YYYY when data is set', () => {
    const field = config[3];
    expect(field.kind).toBe('computed');
    if (field.kind === 'computed') {
      const result = field.buildField({ ...baseDoc, leaseExpiration: '2027-06-30' });
      expect(result.value).toBe('06/30/2027');
    }
  });

  test('idExpiration computed shows No date added when data is null', () => {
    const field = config[6];
    expect(field.kind).toBe('computed');
    if (field.kind === 'computed') {
      const result = field.buildField(null);
      expect(result.label).toBe('ID Expiration');
      expect(result.value).toBe('No date added');
    }
  });

  test('idExpiration computed shows MM/DD/YYYY when data is set', () => {
    const field = config[6];
    expect(field.kind).toBe('computed');
    if (field.kind === 'computed') {
      const result = field.buildField({ ...baseDoc, idExpiration: '2028-12-31' });
      expect(result.value).toBe('12/31/2028');
    }
  });
});
