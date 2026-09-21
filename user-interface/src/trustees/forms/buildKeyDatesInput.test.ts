import { describe, test, expect } from 'vitest';
import { buildKeyDatesInput } from './buildKeyDatesInput';
import {
  DATE_FIELDS,
  NUMBER_FIELDS,
  TEXT_FIELDS,
  TrusteeUpcomingKeyDates,
} from '@common/cams/trustee-upcoming-key-dates';
import { SYSTEM_USER_REFERENCE } from '@common/cams/auditable';

describe('buildKeyDatesInput', () => {
  const ids = { trusteeId: 'trustee-001', appointmentId: 'appointment-001' };

  const original: TrusteeUpcomingKeyDates = {
    id: 'doc-001',
    documentType: 'TRUSTEE_UPCOMING_REPORT_DATES',
    trusteeId: 'trustee-001',
    appointmentId: 'appointment-001',
    createdBy: SYSTEM_USER_REFERENCE,
    createdOn: '2026-01-01T00:00:00.000Z',
    updatedBy: SYSTEM_USER_REFERENCE,
    updatedOn: '2026-01-01T00:00:00.000Z',
    pastAudit: '2025-06-30',
    pastTprSubmission: '2025-09-10',
    tprReviewPeriodStart: '1900-04-01',
    tprReviewPeriodEnd: '1900-03-31',
    tprDue: '1900-09-15',
    tprDueYearType: 'EVEN',
    tprFrequency: 'ANNUAL',
    upcomingExamOrAuditYear: 2029,
    upcomingExamOrAuditType: 'Audit',
    lastAuditFiscalYear: 2024,
    bondRenewalDate: '2026-06-01',
    tprCompletionYear: 2026,
    tprCompletionStatus: 'Complete',
    annualReportCompletionYear: 2025,
    annualReportCompletionStatus: 'Incomplete',
  };

  test('carries every stored field through unchanged when there are no overrides', () => {
    const result = buildKeyDatesInput(ids, original);

    for (const field of [...DATE_FIELDS, ...TEXT_FIELDS, ...NUMBER_FIELDS]) {
      expect(result[field]).toEqual(original[field] ?? null);
    }
    expect(result.upcomingExamOrAuditType).toBe('Audit');
  });

  test('applies overrides on top of the stored values', () => {
    const result = buildKeyDatesInput(ids, original, {
      annualReportCompletionYear: 2026,
      annualReportCompletionStatus: 'Complete',
    });

    expect(result.annualReportCompletionYear).toBe(2026);
    expect(result.annualReportCompletionStatus).toBe('Complete');
    // Everything the caller did not claim is untouched.
    expect(result.tprCompletionYear).toBe(2026);
    expect(result.tprCompletionStatus).toBe('Complete');
    expect(result.pastAudit).toBe('2025-06-30');
    expect(result.bondRenewalDate).toBe('2026-06-01');
  });

  test('allows an override to clear a field', () => {
    const result = buildKeyDatesInput(ids, original, {
      annualReportCompletionYear: null,
      annualReportCompletionStatus: null,
    });

    expect(result.annualReportCompletionYear).toBeNull();
    expect(result.annualReportCompletionStatus).toBeNull();
  });

  test('nulls every field when there is no stored document', () => {
    const result = buildKeyDatesInput(ids, null);

    for (const field of [...DATE_FIELDS, ...TEXT_FIELDS, ...NUMBER_FIELDS]) {
      expect(result[field]).toBeNull();
    }
    expect(result.upcomingExamOrAuditType).toBeNull();
  });

  test('always uses the supplied ids, not the stored ones', () => {
    const result = buildKeyDatesInput(
      { trusteeId: 'trustee-999', appointmentId: 'appointment-999' },
      original,
    );

    expect(result.trusteeId).toBe('trustee-999');
    expect(result.appointmentId).toBe('appointment-999');
  });

  test('ignores attempts to override the ids', () => {
    const result = buildKeyDatesInput(ids, original, {
      trusteeId: 'bogus',
      appointmentId: 'bogus',
    });

    expect(result.trusteeId).toBe('trustee-001');
    expect(result.appointmentId).toBe('appointment-001');
  });
});
