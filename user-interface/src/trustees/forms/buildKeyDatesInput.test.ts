import { describe, test, expect } from 'vitest';
import { buildKeyDatesInput } from './buildKeyDatesInput';
import {
  TrusteeUpcomingKeyDates,
  TrusteeUpcomingKeyDatesInput,
} from '@common/cams/trustee-upcoming-key-dates';
import { SYSTEM_USER_REFERENCE } from '@common/cams/auditable';

describe('buildKeyDatesInput', () => {
  const ids = { trusteeId: 'trustee-001', appointmentId: 'appointment-001' };

  // Every field populated with a distinct value, so a field that is dropped
  // from the payload cannot coincidentally match the expectation.
  const fullOriginal: TrusteeUpcomingKeyDates = {
    id: 'doc-001',
    documentType: 'TRUSTEE_UPCOMING_REPORT_DATES',
    trusteeId: 'trustee-001',
    appointmentId: 'appointment-001',
    createdBy: SYSTEM_USER_REFERENCE,
    createdOn: '2026-01-01T00:00:00.000Z',
    updatedBy: SYSTEM_USER_REFERENCE,
    updatedOn: '2026-01-01T00:00:00.000Z',
    pastBackgroundQuestion: '2020-01-01',
    pastFieldExam: '2020-01-02',
    pastAudit: '2020-01-03',
    pastTprSubmission: '2020-01-04',
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
    upcomingExamOrAuditType: 'Audit',
    tirFrequency: 'SEMI_ANNUAL',
    tirSemiAnnualReviewPeriodStart: '1900-01-01',
    tirSemiAnnualReviewPeriodEnd: '1900-06-30',
    tirSemiAnnualSubmission: '1900-07-30',
    tirSemiAnnualReview: '1900-09-28',
    lastAuditFiscalYear: 2024,
    lastMonthlyReportReceived: '2020-01-05',
    leaseExpiration: '2020-01-06',
    idExpiration: '2020-01-07',
    lastCompensationStudy: '2020-01',
    bondIssuedDate: '2020-01-08',
    bondRenewalDate: '2020-01-09',
    tprCompletionYear: 2026,
    tprCompletionStatus: 'Complete',
    annualReportCompletionYear: 2025,
    annualReportCompletionStatus: 'Incomplete',
  };

  /**
   * Spelled out rather than derived from the field-list constants. The failure
   * this guards against is a field going missing from the payload, and a test
   * that loops over the same list the implementation loops over cannot see
   * that. toEqual compares key sets, so a dropped key fails here; the explicit
   * TrusteeUpcomingKeyDatesInput annotation makes an added model field a
   * compile error.
   */
  const fullExpectedPayload: TrusteeUpcomingKeyDatesInput = {
    trusteeId: 'trustee-001',
    appointmentId: 'appointment-001',
    pastBackgroundQuestion: '2020-01-01',
    pastFieldExam: '2020-01-02',
    pastAudit: '2020-01-03',
    pastTprSubmission: '2020-01-04',
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
    upcomingExamOrAuditType: 'Audit',
    tirFrequency: 'SEMI_ANNUAL',
    tirSemiAnnualReviewPeriodStart: '1900-01-01',
    tirSemiAnnualReviewPeriodEnd: '1900-06-30',
    tirSemiAnnualSubmission: '1900-07-30',
    tirSemiAnnualReview: '1900-09-28',
    lastAuditFiscalYear: 2024,
    lastMonthlyReportReceived: '2020-01-05',
    leaseExpiration: '2020-01-06',
    idExpiration: '2020-01-07',
    lastCompensationStudy: '2020-01',
    bondIssuedDate: '2020-01-08',
    bondRenewalDate: '2020-01-09',
    tprCompletionYear: 2026,
    tprCompletionStatus: 'Complete',
    annualReportCompletionYear: 2025,
    annualReportCompletionStatus: 'Incomplete',
  };

  test('carries every stored field into the payload when there are no overrides', () => {
    expect(buildKeyDatesInput(ids, fullOriginal)).toEqual(fullExpectedPayload);
  });

  test('nulls every field when there is no stored document', () => {
    const allNull = Object.fromEntries(
      Object.keys(fullExpectedPayload)
        .filter((key) => key !== 'trusteeId' && key !== 'appointmentId')
        .map((key) => [key, null]),
    );

    expect(buildKeyDatesInput(ids, null)).toEqual({ ...allNull, ...ids });
  });

  test('applies overrides on top of the stored values and leaves the rest alone', () => {
    const result = buildKeyDatesInput(ids, fullOriginal, {
      annualReportCompletionYear: 2026,
      annualReportCompletionStatus: 'Complete',
    });

    expect(result).toEqual({
      ...fullExpectedPayload,
      annualReportCompletionYear: 2026,
      annualReportCompletionStatus: 'Complete',
    });
  });

  test('allows an override to clear a field', () => {
    const result = buildKeyDatesInput(ids, fullOriginal, {
      annualReportCompletionYear: null,
      annualReportCompletionStatus: null,
    });

    expect(result).toEqual({
      ...fullExpectedPayload,
      annualReportCompletionYear: null,
      annualReportCompletionStatus: null,
    });
  });

  test('preserves upcomingExamOrAuditType, which no field-list constant covers', () => {
    const result = buildKeyDatesInput(ids, fullOriginal, { tprCompletionYear: 2020 });

    expect(result.upcomingExamOrAuditType).toBe('Audit');
  });

  test('always uses the supplied ids, not the stored ones', () => {
    const result = buildKeyDatesInput(
      { trusteeId: 'trustee-999', appointmentId: 'appointment-999' },
      fullOriginal,
    );

    expect(result.trusteeId).toBe('trustee-999');
    expect(result.appointmentId).toBe('appointment-999');
  });

  test('ignores attempts to override the ids', () => {
    const result = buildKeyDatesInput(ids, fullOriginal, {
      trusteeId: 'bogus',
      appointmentId: 'bogus',
    });

    expect(result.trusteeId).toBe('trustee-001');
    expect(result.appointmentId).toBe('appointment-001');
  });
});
