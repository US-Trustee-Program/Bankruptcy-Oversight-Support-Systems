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
    auditCompletionYear: original?.auditCompletionYear ?? null,
    auditCompletionStatus: original?.auditCompletionStatus ?? null,
    tprCompletionYear: original?.tprCompletionYear ?? null,
    tprCompletionStatus: original?.tprCompletionStatus ?? null,
  };
}
