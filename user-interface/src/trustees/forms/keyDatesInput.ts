import {
  TrusteeUpcomingKeyDates,
  TrusteeUpcomingKeyDatesInput,
} from '@common/cams/trustee-upcoming-key-dates';

function getCurrentYear(): number {
  return new Date().getFullYear();
}

export type YearRangeDirection = 'forward' | 'backward';

export function buildYearOptions(direction: YearRangeDirection, span: number): number[] {
  const currentYear = getCurrentYear();
  const sign = direction === 'forward' ? 1 : -1;
  return Array.from({ length: span }, (_, i) => currentYear + sign * i);
}

export function getFiscalYearOptions(): number[] {
  return buildYearOptions('backward', 21);
}

type GenericKeyDatesFields = Omit<TrusteeUpcomingKeyDatesInput, 'trusteeId' | 'appointmentId'>;

/**
 * Carries every generic field forward from the original document, defaulting
 * to null when absent. The return type annotation is a plain (non-Partial,
 * non-spread) object type, so TypeScript rejects this function at compile
 * time if a field is ever added to TrusteeUpcomingKeyDatesInput without being
 * listed here -- the drift class that let CAMS-913's new completion-status
 * fields go unnoticed until caught by inspection (see cams-cm6nc).
 */
function defaultsFromOriginal(original: TrusteeUpcomingKeyDates | null): GenericKeyDatesFields {
  return {
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
    auditCompletionYear: original?.auditCompletionYear ?? null,
    auditCompletionStatus: original?.auditCompletionStatus ?? null,
    tprCompletionYear: original?.tprCompletionYear ?? null,
    tprCompletionStatus: original?.tprCompletionStatus ?? null,
    tirCompletionYear: original?.tirCompletionYear ?? null,
    tirCompletionStatus: original?.tirCompletionStatus ?? null,
    annualReportCompletionYear: original?.annualReportCompletionYear ?? null,
    annualReportCompletionStatus: original?.annualReportCompletionStatus ?? null,
    lastMonthlyReportReceived: original?.lastMonthlyReportReceived ?? null,
    leaseExpiration: original?.leaseExpiration ?? null,
    idExpiration: original?.idExpiration ?? null,
    lastCompensationStudy: original?.lastCompensationStudy ?? null,
    bondIssuedDate: original?.bondIssuedDate ?? null,
    bondRenewalDate: original?.bondRenewalDate ?? null,
    ch13AuditCompletionYear: original?.ch13AuditCompletionYear ?? null,
    ch13AuditCompletionStatus: original?.ch13AuditCompletionStatus ?? null,
  };
}

/**
 * Builds a full TrusteeUpcomingKeyDatesInput by carrying all fields forward from
 * the original document (defaulting to null when absent) and applying only the
 * caller-owned fields via overrides. Each key-dates form owns a distinct subset
 * of fields; this helper prevents any single form from accidentally zeroing out
 * a field it doesn't own when it reconstructs the document for PUT.
 */
export function mergeKeyDatesInput(
  ids: { trusteeId: string; appointmentId: string },
  original: TrusteeUpcomingKeyDates | null,
  overrides: Partial<GenericKeyDatesFields>,
): TrusteeUpcomingKeyDatesInput {
  return {
    trusteeId: ids.trusteeId,
    appointmentId: ids.appointmentId,
    ...defaultsFromOriginal(original),
    ...overrides,
  };
}
