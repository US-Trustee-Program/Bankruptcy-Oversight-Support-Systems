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

export type UpcomingKeyDatesVariant =
  'chapter7-panel' | 'chapter12-standing' | 'chapter13-standing';

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
  label: string;
  value: string;
  testId: string;
  stacked?: boolean;
}

interface ConstantField {
  kind: 'constant';
  key: string;
  displayLabel: string;
  value: string;
  testId: string;
}

interface ComputedField {
  kind: 'computed';
  key: string;
  buildField: (data: TrusteeUpcomingKeyDates | null) => UpcomingKeyDatesDisplayField;
}

export type UpcomingKeyDatesFieldConfig = ConstantField | ComputedField;

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
  return {
    label: 'TPR Review Period Frequency',
    value,
    testId: 'tpr-review-period-frequency-row',
    stacked: true,
  };
}

export function tprReviewPeriodField(
  data: TrusteeUpcomingKeyDates | null,
  label = 'Trustee Performance Review Period',
): UpcomingKeyDatesDisplayField {
  const value =
    data?.tprReviewPeriodStart && data?.tprReviewPeriodEnd
      ? data.tprReviewPeriodStart.startsWith('1900-')
        ? isoRangeToMMDD(data.tprReviewPeriodStart, data.tprReviewPeriodEnd)
        : `${isoToMMDDYYYY(data.tprReviewPeriodStart)} - ${isoToMMDDYYYY(data.tprReviewPeriodEnd)}`
      : NO_DATE;
  return { label, value, testId: 'tpr-review-period-row' };
}

export function tprDueField(
  data: TrusteeUpcomingKeyDates | null,
  label = 'Trustee Performance Review Due',
): UpcomingKeyDatesDisplayField {
  const value =
    data?.tprDue && data?.tprDueYearType
      ? `${isoToMMDD(data.tprDue)}/${calculateTprDueYear(data.tprDueYearType, new Date().getFullYear())}`
      : NO_DATE;
  return { label, value, testId: 'tpr-due-row' };
}

export function leaseExpirationField(
  data: TrusteeUpcomingKeyDates | null,
): UpcomingKeyDatesDisplayField {
  const value = data?.leaseExpiration ? isoToMMDDYYYY(data.leaseExpiration) : NO_DATE;
  return { label: 'Lease Expiration', value, testId: 'lease-expiration-row' };
}

export function idExpirationField(
  data: TrusteeUpcomingKeyDates | null,
): UpcomingKeyDatesDisplayField {
  const value = data?.idExpiration ? isoToMMDDYYYY(data.idExpiration) : NO_DATE;
  return { label: 'ID Expiration', value, testId: 'id-expiration-row' };
}

export function examOrAuditField(
  data: TrusteeUpcomingKeyDates | null,
): UpcomingKeyDatesDisplayField {
  const label = data?.upcomingExamOrAuditType ?? 'Field Exam / Audit';
  const value = data?.upcomingExamOrAuditYear ? String(data.upcomingExamOrAuditYear) : NO_DATE;
  return { label, value, testId: 'upcoming-exam-audit-row' };
}

export function auditReqByField(
  data: TrusteeUpcomingKeyDates | null,
): UpcomingKeyDatesDisplayField {
  const auditReqByYear = calculateAuditReqBy(data?.lastAuditFiscalYear);
  const value = auditReqByYear !== null ? String(auditReqByYear) : NO_DATE;
  return { label: 'Audit Required by', value, testId: 'audit-req-by-row' };
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
  return { label: 'TIR Review Period', value, testId: 'tir-review-period-row' };
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
  return { label: 'TIR Submission', value, testId: 'tir-submission-row' };
}

export function tirReviewField(data: TrusteeUpcomingKeyDates | null): UpcomingKeyDatesDisplayField {
  let value = NO_DATE;
  if (data?.tirReview) {
    value = data.tirSemiAnnualReview
      ? `${isoToMMDD(data.tirReview)} & ${isoToMMDD(data.tirSemiAnnualReview)}`
      : isoToMMDD(data.tirReview);
  }
  return { label: 'TIR Due', value, testId: 'tir-review-row' };
}

export const UPCOMING_KEY_DATES_FIELD_CONFIG: Record<
  UpcomingKeyDatesVariant,
  UpcomingKeyDatesFieldConfig[]
> = {
  'chapter7-panel': [
    {
      kind: 'computed',
      key: 'upcomingExamOrAudit',
      buildField: examOrAuditField,
    },
    {
      kind: 'computed',
      key: 'auditReqBy',
      buildField: auditReqByField,
    },
    {
      kind: 'computed',
      key: 'tprReviewPeriod',
      buildField: tprReviewPeriodField,
    },
    {
      kind: 'computed',
      key: 'tprFrequency',
      buildField: tprFrequencyField,
    },
    {
      kind: 'computed',
      key: 'tprDue',
      buildField: tprDueField,
    },
    {
      kind: 'computed',
      key: 'tirReviewPeriod',
      buildField: tirReviewPeriodField,
    },
    {
      kind: 'computed',
      key: 'tirSubmission',
      buildField: tirSubmissionField,
    },
    {
      kind: 'computed',
      key: 'tirReview',
      buildField: tirReviewField,
    },
  ],
  'chapter12-standing': [
    {
      kind: 'computed',
      key: 'auditReqBy',
      buildField: (data) => {
        const auditReqByYear = calculateAuditReqBy(data?.lastAuditFiscalYear);
        const value = auditReqByYear !== null ? String(auditReqByYear) : NO_DATE;
        return { label: 'Audit Recommended by', value, testId: 'audit-req-by-row' };
      },
    },
    {
      kind: 'constant',
      key: 'annualReportDueToOO',
      displayLabel: 'Annual Report Due to OO',
      value: '09/30 (Due non-audit years)',
      testId: 'annual-report-due-row',
    },
    {
      kind: 'computed',
      key: 'tprReviewPeriod',
      buildField: tprReviewPeriodField,
    },
    {
      kind: 'computed',
      key: 'tprFrequency',
      buildField: tprFrequencyField,
    },
    {
      kind: 'computed',
      key: 'tprDue',
      buildField: tprDueField,
    },
    {
      kind: 'computed',
      key: 'leaseExpiration',
      buildField: leaseExpirationField,
    },
    {
      kind: 'constant',
      key: 'budgetSubmissionDue',
      displayLabel: 'Budget Submission Due',
      value: '05/01',
      testId: 'budget-submission-due-row',
    },
    {
      kind: 'constant',
      key: 'budgetReviewToOO',
      displayLabel: 'Budget Due to OO',
      value: '06/01',
      testId: 'budget-review-to-oo-row',
    },
    {
      kind: 'computed',
      key: 'idExpiration',
      buildField: idExpirationField,
    },
  ],
  'chapter13-standing': [
    {
      kind: 'constant',
      key: 'annualAuditReviewPeriod',
      displayLabel: 'Annual Audit Review Period',
      value: '10/01 - 09/30',
      testId: 'annual-audit-review-period-row',
    },
    {
      kind: 'computed',
      key: 'tprReviewPeriod',
      buildField: (data) => tprReviewPeriodField(data, 'TPR Review Period'),
    },
    {
      kind: 'computed',
      key: 'tprFrequency',
      buildField: tprFrequencyField,
    },
    {
      kind: 'computed',
      key: 'tprDue',
      buildField: (data) => tprDueField(data, 'TPR Due'),
    },
    {
      kind: 'computed',
      key: 'leaseExpiration',
      buildField: leaseExpirationField,
    },
    {
      kind: 'constant',
      key: 'budgetSubmissionDue',
      displayLabel: 'Budget Submission Due',
      value: '07/01',
      testId: 'budget-submission-due-row',
    },
    {
      kind: 'constant',
      key: 'budgetReviewToOO',
      displayLabel: 'Budget Due to OO',
      value: '08/15',
      testId: 'budget-review-to-oo-row',
    },
    {
      kind: 'computed',
      key: 'idExpiration',
      buildField: idExpirationField,
    },
  ],
};

export function getUpcomingKeyDatesFieldConfig(
  variant: UpcomingKeyDatesVariant,
  tprDisplayUpdates: boolean,
): UpcomingKeyDatesFieldConfig[] {
  if (tprDisplayUpdates) {
    return UPCOMING_KEY_DATES_FIELD_CONFIG[variant];
  }

  return UPCOMING_KEY_DATES_FIELD_CONFIG[variant]
    .filter((f) => f.key !== 'tprFrequency')
    .map((f): UpcomingKeyDatesFieldConfig => {
      if (f.kind !== 'computed') return f;

      if (f.key === 'tprDue') {
        return {
          kind: 'computed',
          key: f.key,
          buildField: (data: TrusteeUpcomingKeyDates | null) => {
            const template = f.buildField(null);
            const value =
              data?.tprDue && data?.tprDueYearType
                ? `${isoToMMDD(data.tprDue)} ${data.tprDueYearType}`
                : 'No date added';
            return { ...template, value };
          },
        };
      }

      if (f.key === 'tprReviewPeriod') {
        return {
          kind: 'computed',
          key: f.key,
          buildField: (data: TrusteeUpcomingKeyDates | null) => {
            const template = f.buildField(null);
            const value =
              data?.tprReviewPeriodStart && data?.tprReviewPeriodEnd
                ? isoRangeToMMDD(data.tprReviewPeriodStart, data.tprReviewPeriodEnd)
                : 'No date added';
            return { ...template, value };
          },
        };
      }

      return f;
    });
}
