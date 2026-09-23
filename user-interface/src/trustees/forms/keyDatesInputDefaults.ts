import {
  TrusteeUpcomingKeyDates,
  TrusteeUpcomingKeyDatesInput,
} from '@common/cams/trustee-upcoming-key-dates';

const currentYear = new Date().getFullYear();
export const COMPLETION_YEAR_OPTIONS = Array.from({ length: 11 }, (_, i) => currentYear - i);

/**
 * Defaults every field of TrusteeUpcomingKeyDatesInput from the previously-saved record.
 * Each Chapter 13 Standing key-dates form spreads this and then overrides only the
 * handful of fields it owns with its own form state.
 *
 * auditCompletionYear/Status, tprCompletionYear/Status, tirCompletionYear/Status, and
 * annualReportCompletionYear/Status belong to other appointment domains (Chapter 7
 * Panel, and Chapter 12/13 Case by Case, respectively -- different value sets than
 * Ch13's own ch13AuditCompletionStatus/ch13TprCompletionStatus) and a Chapter 13
 * Standing appointment never legitimately owns them, so they're hard-nulled here
 * rather than carried forward from `original` -- passing through stale/foreign values
 * would fail validation and, since upsert does a full document replace, this also
 * self-heals any document that already has legacy data in those fields.
 */
export function buildKeyDatesInputFromOriginal(
  trusteeId: string,
  appointmentId: string,
  original: TrusteeUpcomingKeyDates | null,
): TrusteeUpcomingKeyDatesInput {
  return {
    trusteeId,
    appointmentId,
    pastBackgroundQuestion: original?.pastBackgroundQuestion ?? null,
    pastFieldExam: original?.pastFieldExam ?? null,
    pastAudit: original?.pastAudit ?? null,
    pastTprSubmission: original?.pastTprSubmission ?? null,
    lastTprSubmitted: original?.lastTprSubmitted ?? null,
    tprReviewPeriodStart: original?.tprReviewPeriodStart ?? null,
    tprReviewPeriodEnd: original?.tprReviewPeriodEnd ?? null,
    tprDue: original?.tprDue ?? null,
    tprDueYearType: original?.tprDueYearType ?? null,
    tprFrequency: original?.tprFrequency ?? null,
    tirReviewPeriodStart: original?.tirReviewPeriodStart ?? null,
    tirReviewPeriodEnd: original?.tirReviewPeriodEnd ?? null,
    tirSubmission: original?.tirSubmission ?? null,
    tirReview: original?.tirReview ?? null,
    upcomingExamOrAuditYear: original?.upcomingExamOrAuditYear ?? null,
    upcomingExamOrAuditType: original?.upcomingExamOrAuditType ?? null,
    tirFrequency: original?.tirFrequency ?? null,
    tirSemiAnnualReviewPeriodStart: original?.tirSemiAnnualReviewPeriodStart ?? null,
    tirSemiAnnualReviewPeriodEnd: original?.tirSemiAnnualReviewPeriodEnd ?? null,
    tirSemiAnnualSubmission: original?.tirSemiAnnualSubmission ?? null,
    tirSemiAnnualReview: original?.tirSemiAnnualReview ?? null,
    lastAuditFiscalYear: original?.lastAuditFiscalYear ?? null,
    lastMonthlyReportReceived: original?.lastMonthlyReportReceived ?? null,
    leaseExpiration: original?.leaseExpiration ?? null,
    idExpiration: original?.idExpiration ?? null,
    lastCompensationStudy: original?.lastCompensationStudy ?? null,
    bondIssuedDate: original?.bondIssuedDate ?? null,
    bondRenewalDate: original?.bondRenewalDate ?? null,
    auditCompletionYear: null,
    auditCompletionStatus: null,
    tprCompletionYear: null,
    tprCompletionStatus: null,
    tirCompletionYear: null,
    tirCompletionStatus: null,
    annualReportCompletionYear: null,
    annualReportCompletionStatus: null,
    ch13AuditCompletionYear: original?.ch13AuditCompletionYear ?? null,
    ch13AuditCompletionStatus: original?.ch13AuditCompletionStatus ?? null,
    ch13TprCompletionYear: original?.ch13TprCompletionYear ?? null,
    ch13TprCompletionStatus: original?.ch13TprCompletionStatus ?? null,
  };
}
