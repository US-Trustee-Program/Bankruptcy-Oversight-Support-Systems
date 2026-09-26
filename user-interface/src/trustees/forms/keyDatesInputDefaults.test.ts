import { describe, test, expect } from 'vitest';
import { TrusteeUpcomingKeyDates } from '@common/cams/trustee-upcoming-key-dates';
import { buildKeyDatesInputFromOriginal } from './keyDatesInputDefaults';
import { SYSTEM_USER_REFERENCE } from '@common/cams/auditable';

describe('buildKeyDatesInputFromOriginal', () => {
  const ids = { trusteeId: 'trustee-001', appointmentId: 'appointment-001' };

  const fullOriginal: TrusteeUpcomingKeyDates = {
    id: 'key-dates-001',
    documentType: 'TRUSTEE_UPCOMING_REPORT_DATES',
    trusteeId: ids.trusteeId,
    appointmentId: ids.appointmentId,
    createdBy: SYSTEM_USER_REFERENCE,
    createdOn: '2026-01-01T00:00:00.000Z',
    updatedBy: SYSTEM_USER_REFERENCE,
    updatedOn: '2026-01-01T00:00:00.000Z',
    pastBackgroundQuestion: '2025-01-01',
    pastFieldExam: '2025-01-02',
    pastAudit: '2025-01-03',
    pastTprSubmission: '2025-01-04',
    lastTprSubmitted: '2025-01-05',
    tprReviewPeriodStart: '2025-04-01',
    tprReviewPeriodEnd: '2025-09-30',
    tprDue: '1900-09-15',
    tprDueYearType: 'EVEN',
    tprFrequency: 'ANNUAL',
    tirReviewPeriodStart: '1900-07-01',
    tirReviewPeriodEnd: '1900-06-30',
    tirSubmission: '1900-10-15',
    tirReview: '1900-11-01',
    upcomingExamOrAuditYear: 2027,
    upcomingExamOrAuditType: 'Audit',
    tirFrequency: 'SEMI_ANNUAL',
    tirSemiAnnualReviewPeriodStart: '1900-01-01',
    tirSemiAnnualReviewPeriodEnd: '1900-06-30',
    tirSemiAnnualSubmission: '1900-07-30',
    tirSemiAnnualReview: '1900-09-28',
    lastAuditFiscalYear: 2024,
    lastMonthlyReportReceived: '2025-06-01',
    leaseExpiration: '2027-06-30',
    idExpiration: '2028-01-15',
    lastCompensationStudy: '2024-06-01',
    bondIssuedDate: '2022-06-01',
    bondRenewalDate: '2025-06-01',
    // Chapter 7 Panel-domain fields: a Ch13 Standing document should never
    // legitimately have these set, but a document could still carry stale
    // values (e.g. from before the ch13 field rename); buildKeyDatesInputFromOriginal
    // must hard-null them regardless of what's present here.
    auditCompletionYear: 2020,
    auditCompletionStatus: 'CLOSED',
    tprCompletionYear: 2021,
    tprCompletionStatus: 'COMPLETE',
    tirCompletionYear: 2022,
    tirCompletionStatus: 'INCOMPLETE',
    ch13AuditCompletionYear: 2026,
    ch13AuditCompletionStatus: 'Complete',
    ch13TprCompletionYear: 2026,
    ch13TprCompletionStatus: 'Incomplete',
  };

  test('carries every non-Chapter-7-Panel field forward from the original document', () => {
    const result = buildKeyDatesInputFromOriginal(ids.trusteeId, ids.appointmentId, fullOriginal);

    expect(result).toEqual({
      trusteeId: ids.trusteeId,
      appointmentId: ids.appointmentId,
      pastBackgroundQuestion: '2025-01-01',
      pastFieldExam: '2025-01-02',
      pastAudit: '2025-01-03',
      pastTprSubmission: '2025-01-04',
      lastTprSubmitted: '2025-01-05',
      tprReviewPeriodStart: '2025-04-01',
      tprReviewPeriodEnd: '2025-09-30',
      tprDue: '1900-09-15',
      tprDueYearType: 'EVEN',
      tprFrequency: 'ANNUAL',
      tirReviewPeriodStart: '1900-07-01',
      tirReviewPeriodEnd: '1900-06-30',
      tirSubmission: '1900-10-15',
      tirReview: '1900-11-01',
      upcomingExamOrAuditYear: 2027,
      upcomingExamOrAuditType: 'Audit',
      tirFrequency: 'SEMI_ANNUAL',
      tirSemiAnnualReviewPeriodStart: '1900-01-01',
      tirSemiAnnualReviewPeriodEnd: '1900-06-30',
      tirSemiAnnualSubmission: '1900-07-30',
      tirSemiAnnualReview: '1900-09-28',
      lastAuditFiscalYear: 2024,
      lastMonthlyReportReceived: '2025-06-01',
      leaseExpiration: '2027-06-30',
      idExpiration: '2028-01-15',
      lastCompensationStudy: '2024-06-01',
      bondIssuedDate: '2022-06-01',
      bondRenewalDate: '2025-06-01',
      auditCompletionYear: null,
      auditCompletionStatus: null,
      tprCompletionYear: null,
      tprCompletionStatus: null,
      tirCompletionYear: null,
      tirCompletionStatus: null,
      annualReportCompletionYear: null,
      annualReportCompletionStatus: null,
      ch13AuditCompletionYear: 2026,
      ch13AuditCompletionStatus: 'Complete',
      ch13TprCompletionYear: 2026,
      ch13TprCompletionStatus: 'Incomplete',
    });
  });

  test('hard-nulls Chapter 7 Panel-domain completion fields even when the original document has stale values', () => {
    const result = buildKeyDatesInputFromOriginal(ids.trusteeId, ids.appointmentId, fullOriginal);

    expect(result.auditCompletionYear).toBeNull();
    expect(result.auditCompletionStatus).toBeNull();
    expect(result.tprCompletionYear).toBeNull();
    expect(result.tprCompletionStatus).toBeNull();
    expect(result.tirCompletionYear).toBeNull();
    expect(result.tirCompletionStatus).toBeNull();
  });

  test('defaults every field to null when there is no original document', () => {
    const result = buildKeyDatesInputFromOriginal(ids.trusteeId, ids.appointmentId, null);

    expect(result).toEqual({
      trusteeId: ids.trusteeId,
      appointmentId: ids.appointmentId,
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
      lastMonthlyReportReceived: null,
      leaseExpiration: null,
      idExpiration: null,
      lastCompensationStudy: null,
      bondIssuedDate: null,
      bondRenewalDate: null,
      auditCompletionYear: null,
      auditCompletionStatus: null,
      tprCompletionYear: null,
      tprCompletionStatus: null,
      tirCompletionYear: null,
      tirCompletionStatus: null,
      annualReportCompletionYear: null,
      annualReportCompletionStatus: null,
      ch13AuditCompletionYear: null,
      ch13AuditCompletionStatus: null,
      ch13TprCompletionYear: null,
      ch13TprCompletionStatus: null,
    });
  });
});
