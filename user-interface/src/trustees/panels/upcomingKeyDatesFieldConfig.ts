import {
  TrusteeUpcomingKeyDates,
  isoToMMDD,
  isoToMMDDYYYY,
  isoRangeToMMDD,
  calculateAuditReqBy,
  calculateTprDueYear,
} from '@common/cams/trustee-upcoming-key-dates';
import {
  EditableTableCardTag,
  EditableTableCardTagColor,
} from '@/lib/components/cams/EditableTableCard/EditableTableCard';

export const NO_DATE = 'No date added';

export interface CompletionTagLabels {
  closed: string;
  notClosed: string;
}

const DEFAULT_COMPLETION_TAG_LABELS: CompletionTagLabels = {
  closed: 'Complete',
  notClosed: 'Incomplete',
};

/**
 * The completion year and status are stored as a pair, so a tag is only
 * meaningful when both are present.
 *
 * `null` counts as absent, not as a value. The document type declares these
 * fields optional while the input type declares them nullable, and the values
 * come from stored data, so both shapes reach here. Checking only for
 * `undefined` rendered 'Incomplete for null' for a null year, and a null status
 * rendered a confident 'Incomplete for <year>' for a report whose status was
 * simply unset.
 */
export function buildCompletionTag(
  year: number | null | undefined,
  status: string | null | undefined,
  closedValue: string,
  id: string,
  labels: CompletionTagLabels = DEFAULT_COMPLETION_TAG_LABELS,
): EditableTableCardTag | undefined {
  if (year == null || status == null) return undefined;
  const isClosed = status === closedValue;
  return {
    label: `${isClosed ? labels.closed : labels.notClosed} for ${year}`,
    color: (isClosed ? 'green' : 'red') as EditableTableCardTagColor,
    id,
  };
}

export function formatDateOrDefault(isoDate: string | undefined): string {
  return isoDate ? isoToMMDDYYYY(isoDate) : NO_DATE;
}

interface UpcomingKeyDatesDisplayField {
  value: string;
  stacked?: boolean;
}

export function tprFrequencyField(
  data: TrusteeUpcomingKeyDates | null,
): UpcomingKeyDatesDisplayField {
  const frequencyLabels: Record<string, string> = {
    BIANNUAL: 'Two years',
    ANNUAL: 'One year',
    SEMI_ANNUAL: '6 months',
  };
  const value = data?.tprFrequency
    ? (frequencyLabels[data.tprFrequency] ?? 'No frequency selected')
    : 'No frequency selected';
  return { value, stacked: true };
}

export function tprReviewPeriodField(
  data: TrusteeUpcomingKeyDates | null,
): UpcomingKeyDatesDisplayField {
  const value =
    data?.tprReviewPeriodStart && data?.tprReviewPeriodEnd
      ? data.tprReviewPeriodStart.startsWith('1900-')
        ? isoRangeToMMDD(data.tprReviewPeriodStart, data.tprReviewPeriodEnd)
        : `${isoToMMDDYYYY(data.tprReviewPeriodStart)} - ${isoToMMDDYYYY(data.tprReviewPeriodEnd)}`
      : NO_DATE;
  return { value };
}

export function tprDueField(data: TrusteeUpcomingKeyDates | null): UpcomingKeyDatesDisplayField {
  const value =
    data?.tprDue && data?.tprDueYearType
      ? `${isoToMMDD(data.tprDue)}/${calculateTprDueYear(data.tprDueYearType, new Date().getFullYear())}`
      : NO_DATE;
  return { value };
}

export function leaseExpirationField(
  data: TrusteeUpcomingKeyDates | null,
): UpcomingKeyDatesDisplayField {
  const value = data?.leaseExpiration ? isoToMMDDYYYY(data.leaseExpiration) : NO_DATE;
  return { value };
}

export function idExpirationField(
  data: TrusteeUpcomingKeyDates | null,
): UpcomingKeyDatesDisplayField {
  const value = data?.idExpiration ? isoToMMDDYYYY(data.idExpiration) : NO_DATE;
  return { value };
}

export function examOrAuditLabel(data: TrusteeUpcomingKeyDates | null): string {
  return data?.upcomingExamOrAuditType ?? 'Field Exam / Audit';
}

export function examOrAuditField(
  data: TrusteeUpcomingKeyDates | null,
): UpcomingKeyDatesDisplayField {
  const value = data?.upcomingExamOrAuditYear ? String(data.upcomingExamOrAuditYear) : NO_DATE;
  return { value };
}

export function auditReqByField(
  data: TrusteeUpcomingKeyDates | null,
): UpcomingKeyDatesDisplayField {
  const auditReqByYear = calculateAuditReqBy(data?.lastAuditFiscalYear);
  const value = auditReqByYear !== null ? String(auditReqByYear) : NO_DATE;
  return { value };
}

export function tirReviewPeriodField(
  data: TrusteeUpcomingKeyDates | null,
): UpcomingKeyDatesDisplayField {
  let value = NO_DATE;
  if (data?.tirReviewPeriodStart && data?.tirReviewPeriodEnd) {
    const period1 = isoRangeToMMDD(data.tirReviewPeriodStart, data.tirReviewPeriodEnd);
    if (data.tirSemiAnnualReviewPeriodStart && data.tirSemiAnnualReviewPeriodEnd) {
      const period2 = isoRangeToMMDD(
        data.tirSemiAnnualReviewPeriodStart,
        data.tirSemiAnnualReviewPeriodEnd,
      );
      value = `${period1} & ${period2}`;
    } else {
      value = period1;
    }
  }
  return { value };
}

export function tirSubmissionField(
  data: TrusteeUpcomingKeyDates | null,
): UpcomingKeyDatesDisplayField {
  let value = NO_DATE;
  if (data?.tirSubmission) {
    value = data.tirSemiAnnualSubmission
      ? `${isoToMMDD(data.tirSubmission)} & ${isoToMMDD(data.tirSemiAnnualSubmission)}`
      : isoToMMDD(data.tirSubmission);
  }
  return { value };
}

export function tirReviewField(data: TrusteeUpcomingKeyDates | null): UpcomingKeyDatesDisplayField {
  let value = NO_DATE;
  if (data?.tirReview) {
    value = data.tirSemiAnnualReview
      ? `${isoToMMDD(data.tirReview)} & ${isoToMMDD(data.tirSemiAnnualReview)}`
      : isoToMMDD(data.tirReview);
  }
  return { value };
}
