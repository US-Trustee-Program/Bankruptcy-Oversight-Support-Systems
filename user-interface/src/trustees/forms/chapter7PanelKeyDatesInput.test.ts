import { describe, test, expect } from 'vitest';
import { mergeKeyDatesInput } from './chapter7PanelKeyDatesInput';
import { TrusteeUpcomingKeyDates } from '@common/cams/trustee-upcoming-key-dates';
import { SYSTEM_USER_REFERENCE } from '@common/cams/auditable';

const ids = { trusteeId: 'trustee-001', appointmentId: 'appointment-001' };

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
  lastTprSubmitted: '2020-01-05',
  tprReviewPeriodStart: '2020-01-06',
  tprReviewPeriodEnd: '2020-01-07',
  tprDue: '1900-10-06',
  tprDueYearType: 'EVEN',
  tprFrequency: 'ANNUAL',
  tirReviewPeriodStart: '2020-01-08',
  tirReviewPeriodEnd: '2020-01-09',
  tirSubmission: '2020-01-10',
  tirReview: '2020-01-11',
  upcomingExamOrAuditYear: 2024,
  upcomingExamOrAuditType: 'Field Exam',
  tirFrequency: 'SEMI_ANNUAL',
  tirSemiAnnualReviewPeriodStart: '2020-01-12',
  tirSemiAnnualReviewPeriodEnd: '2020-01-13',
  tirSemiAnnualSubmission: '2020-01-14',
  tirSemiAnnualReview: '2020-01-15',
  lastAuditFiscalYear: 2021,
  auditCompletionYear: 2021,
  auditCompletionStatus: 'NOT_CLOSED',
  tprCompletionYear: 2022,
  tprCompletionStatus: 'INCOMPLETE',
  tirCompletionYear: 2023,
  tirCompletionStatus: 'COMPLETE',
  lastMonthlyReportReceived: '2020-01-16',
  leaseExpiration: '2020-01-17',
  idExpiration: '2020-01-18',
  lastCompensationStudy: '2020-01-19',
  bondIssuedDate: '2020-01-20',
  bondRenewalDate: '2020-01-21',
  ch13AuditCompletionYear: 2025,
  ch13AuditCompletionStatus: 'Complete',
  ch13TprCompletionYear: 2025,
  ch13TprCompletionStatus: 'Incomplete',
};

describe('mergeKeyDatesInput', () => {
  test('carries all fields forward from original when no overrides are provided', () => {
    const result = mergeKeyDatesInput(ids, fullOriginal, {});

    expect(result).toEqual({
      trusteeId: 'trustee-001',
      appointmentId: 'appointment-001',
      pastBackgroundQuestion: '2020-01-01',
      pastFieldExam: '2020-01-02',
      pastAudit: '2020-01-03',
      pastTprSubmission: '2020-01-04',
      lastTprSubmitted: '2020-01-05',
      tprReviewPeriodStart: '2020-01-06',
      tprReviewPeriodEnd: '2020-01-07',
      tprDue: '1900-10-06',
      tprDueYearType: 'EVEN',
      tprFrequency: 'ANNUAL',
      tirReviewPeriodStart: '2020-01-08',
      tirReviewPeriodEnd: '2020-01-09',
      tirSubmission: '2020-01-10',
      tirReview: '2020-01-11',
      upcomingExamOrAuditYear: 2024,
      upcomingExamOrAuditType: 'Field Exam',
      tirFrequency: 'SEMI_ANNUAL',
      tirSemiAnnualReviewPeriodStart: '2020-01-12',
      tirSemiAnnualReviewPeriodEnd: '2020-01-13',
      tirSemiAnnualSubmission: '2020-01-14',
      tirSemiAnnualReview: '2020-01-15',
      lastAuditFiscalYear: 2021,
      auditCompletionYear: 2021,
      auditCompletionStatus: 'NOT_CLOSED',
      tprCompletionYear: 2022,
      tprCompletionStatus: 'INCOMPLETE',
      tirCompletionYear: 2023,
      tirCompletionStatus: 'COMPLETE',
      lastMonthlyReportReceived: '2020-01-16',
      leaseExpiration: '2020-01-17',
      idExpiration: '2020-01-18',
      lastCompensationStudy: '2020-01-19',
      bondIssuedDate: '2020-01-20',
      bondRenewalDate: '2020-01-21',
      annualReportCompletionYear: null,
      annualReportCompletionStatus: null,
      ch13AuditCompletionYear: 2025,
      ch13AuditCompletionStatus: 'Complete',
      ch13TprCompletionYear: 2025,
      ch13TprCompletionStatus: 'Incomplete',
    });
  });

  test('overrides replace original values for the specified fields only', () => {
    const result = mergeKeyDatesInput(ids, fullOriginal, {
      pastFieldExam: '2026-05-01',
      pastAudit: null,
    });

    expect(result.pastFieldExam).toBe('2026-05-01');
    expect(result.pastAudit).toBeNull();
    expect(result.pastBackgroundQuestion).toBe('2020-01-01');
    expect(result.tprFrequency).toBe('ANNUAL');
  });

  test('defaults every field to null when original is null', () => {
    const result = mergeKeyDatesInput(ids, null, {});

    expect(result.trusteeId).toBe('trustee-001');
    expect(result.appointmentId).toBe('appointment-001');
    expect(result.pastBackgroundQuestion).toBeNull();
    expect(result.tprFrequency).toBeNull();
    expect(result.bondRenewalDate).toBeNull();
  });

  test('overrides apply even when original is null', () => {
    const result = mergeKeyDatesInput(ids, null, {
      pastBackgroundQuestion: '2026-01-01',
      tprFrequency: 'SEMI_ANNUAL',
    });

    expect(result.pastBackgroundQuestion).toBe('2026-01-01');
    expect(result.tprFrequency).toBe('SEMI_ANNUAL');
    expect(result.pastFieldExam).toBeNull();
  });
});
