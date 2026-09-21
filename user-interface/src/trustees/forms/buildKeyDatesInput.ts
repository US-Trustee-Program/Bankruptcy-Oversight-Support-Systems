import {
  TrusteeUpcomingKeyDates,
  TrusteeUpcomingKeyDatesInput,
} from '@common/cams/trustee-upcoming-key-dates';

type PreservedField = keyof Omit<TrusteeUpcomingKeyDatesInput, 'trusteeId' | 'appointmentId'>;

/**
 * Every field the PUT payload carries, other than the ids.
 *
 * Typed as a total Record so that adding a field to TrusteeUpcomingKeyDatesInput
 * without listing it here is a compile error. Deriving the list from the
 * DATE_FIELDS / TEXT_FIELDS / NUMBER_FIELDS constants would not give that
 * guarantee: upcomingExamOrAuditType belongs to none of them, so a new field
 * could go missing from both the payload and any test written against those
 * same constants.
 */
const PRESERVED_FIELDS: Record<PreservedField, true> = {
  pastBackgroundQuestion: true,
  pastFieldExam: true,
  pastAudit: true,
  pastTprSubmission: true,
  tprReviewPeriodStart: true,
  tprReviewPeriodEnd: true,
  tprDue: true,
  tprDueYearType: true,
  tprFrequency: true,
  tirReviewPeriodStart: true,
  tirReviewPeriodEnd: true,
  tirSubmission: true,
  tirReview: true,
  upcomingExamOrAuditYear: true,
  upcomingExamOrAuditType: true,
  tirFrequency: true,
  tirSemiAnnualReviewPeriodStart: true,
  tirSemiAnnualReviewPeriodEnd: true,
  tirSemiAnnualSubmission: true,
  tirSemiAnnualReview: true,
  lastAuditFiscalYear: true,
  lastMonthlyReportReceived: true,
  leaseExpiration: true,
  idExpiration: true,
  lastCompensationStudy: true,
  bondIssuedDate: true,
  bondRenewalDate: true,
  tprCompletionYear: true,
  tprCompletionStatus: true,
  annualReportCompletionYear: true,
  annualReportCompletionStatus: true,
};

export const PRESERVED_FIELD_NAMES = Object.keys(PRESERVED_FIELDS) as PreservedField[];

/**
 * Builds a full key-dates PUT payload from the document that was loaded,
 * applying only the fields the caller's form actually owns.
 *
 * The API replaces the whole document, so a form that omits a field it does not
 * edit would silently clear it.
 */
export function buildKeyDatesInput(
  ids: { trusteeId: string; appointmentId: string },
  original: TrusteeUpcomingKeyDates | null,
  overrides: Partial<TrusteeUpcomingKeyDatesInput> = {},
): TrusteeUpcomingKeyDatesInput {
  const preserved = {} as Record<PreservedField, unknown>;
  for (const field of PRESERVED_FIELD_NAMES) {
    preserved[field] = original?.[field] ?? null;
  }

  return {
    ...(preserved as unknown as TrusteeUpcomingKeyDatesInput),
    ...overrides,
    trusteeId: ids.trusteeId,
    appointmentId: ids.appointmentId,
  };
}
