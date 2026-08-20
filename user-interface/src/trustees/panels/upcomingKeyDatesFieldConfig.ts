import {
  TrusteeUpcomingKeyDates,
  isoToMMDD,
  isoRangeToMMDD,
  calculateAuditReqBy,
} from '@common/cams/trustee-upcoming-key-dates';

export type UpcomingKeyDatesVariant = 'chapter7-panel' | 'ch12-13-case-by-case';

const NO_DATE = 'No date added';

interface UpcomingKeyDatesDisplayField {
  label: string;
  value: string;
  testId: string;
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

function tprReviewPeriodField(data: TrusteeUpcomingKeyDates | null): UpcomingKeyDatesDisplayField {
  const value =
    data?.tprReviewPeriodStart && data?.tprReviewPeriodEnd
      ? isoRangeToMMDD(data.tprReviewPeriodStart, data.tprReviewPeriodEnd)
      : NO_DATE;
  return { label: 'Trustee Performance Review Period', value, testId: 'tpr-review-period-row' };
}

function tprDueField(data: TrusteeUpcomingKeyDates | null): UpcomingKeyDatesDisplayField {
  const value =
    data?.tprDue && data?.tprDueYearType
      ? `${isoToMMDD(data.tprDue)} ${data.tprDueYearType}`
      : NO_DATE;
  return { label: 'Trustee Performance Review Due', value, testId: 'tpr-due-row' };
}

export const UPCOMING_KEY_DATES_FIELD_CONFIG: Record<
  UpcomingKeyDatesVariant,
  UpcomingKeyDatesFieldConfig[]
> = {
  'chapter7-panel': [
    {
      kind: 'computed',
      key: 'upcomingExamOrAudit',
      buildField: (data) => {
        const label = data?.upcomingExamOrAuditType ?? 'Field Exam / Audit';
        const value = data?.upcomingExamOrAuditYear
          ? String(data.upcomingExamOrAuditYear)
          : NO_DATE;
        return { label, value, testId: 'upcoming-exam-audit-row' };
      },
    },
    {
      kind: 'computed',
      key: 'auditReqBy',
      buildField: (data) => {
        const auditReqByYear = calculateAuditReqBy(data?.lastAuditFiscalYear);
        const value = auditReqByYear !== null ? String(auditReqByYear) : NO_DATE;
        return { label: 'Audit Required by', value, testId: 'audit-req-by-row' };
      },
    },
    {
      kind: 'computed',
      key: 'tprReviewPeriod',
      buildField: tprReviewPeriodField,
    },
    {
      kind: 'computed',
      key: 'tprDue',
      buildField: tprDueField,
    },
    {
      kind: 'computed',
      key: 'tirReviewPeriod',
      buildField: (data) => {
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
      },
    },
    {
      kind: 'computed',
      key: 'tirSubmission',
      buildField: (data) => {
        let value = NO_DATE;
        if (data?.tirSubmission) {
          value = data.tirSemiAnnualSubmission
            ? `${isoToMMDD(data.tirSubmission)} & ${isoToMMDD(data.tirSemiAnnualSubmission)}`
            : isoToMMDD(data.tirSubmission);
        }
        return { label: 'TIR Submission', value, testId: 'tir-submission-row' };
      },
    },
    {
      kind: 'computed',
      key: 'tirReview',
      buildField: (data) => {
        let value = NO_DATE;
        if (data?.tirReview) {
          value = data.tirSemiAnnualReview
            ? `${isoToMMDD(data.tirReview)} & ${isoToMMDD(data.tirSemiAnnualReview)}`
            : isoToMMDD(data.tirReview);
        }
        return { label: 'TIR Due', value, testId: 'tir-review-row' };
      },
    },
  ],
  'ch12-13-case-by-case': [
    {
      kind: 'constant',
      key: 'annualReportSubmission',
      displayLabel: 'Annual Report Submission',
      value: '09/01',
      testId: 'annual-report-submission-row',
    },
    {
      kind: 'constant',
      key: 'annualReportDueToOO',
      displayLabel: 'Annual Report Due to OO',
      value: '09/15',
      testId: 'annual-report-due-oo-row',
    },
    {
      kind: 'computed',
      key: 'tprReviewPeriod',
      buildField: tprReviewPeriodField,
    },
    {
      kind: 'computed',
      key: 'tprDue',
      buildField: tprDueField,
    },
  ],
};
