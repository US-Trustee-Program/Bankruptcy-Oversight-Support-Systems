export type PastKeyDatesVariant = 'chapter11-subv' | 'chapter12-standing' | 'chapter13-standing';

const DEFAULT_PAST_KEY_DATES_LABELS = {
  cardTitle: 'Past Key Dates',
  editHeading: 'Edit Past Key Dates',
};

export const PAST_KEY_DATES_VARIANT_LABELS: Record<
  PastKeyDatesVariant,
  { cardTitle: string; editHeading: string }
> = {
  'chapter11-subv': { cardTitle: 'Other', editHeading: 'Edit Other Key Dates' },
  'chapter12-standing': DEFAULT_PAST_KEY_DATES_LABELS,
  'chapter13-standing': DEFAULT_PAST_KEY_DATES_LABELS,
};

export type PastDateFieldKey =
  | 'pastBackgroundQuestion'
  | 'pastFieldExam'
  | 'pastAudit'
  | 'pastTprSubmission'
  | 'lastMonthlyReportReceived'
  | 'lastCompensationStudy'
  | 'bondIssuedDate';

interface PastKeyDatesFieldConfigBase {
  /** Label shown on the read-only Past Key Dates display card. */
  displayLabel: string;
  /** Label shown on the Edit Past Key Dates form. Differs from displayLabel for pastAudit. */
  formLabel: string;
  hint?: string;
  /** Note shown below the value on the read-only Past Key Dates display card. */
  displayNote?: string;
  testId: string;
  inputId: string;
  /** Renders the value on its own line below the label on the display card. */
  stacked?: boolean;
}

interface DateField extends PastKeyDatesFieldConfigBase {
  kind: 'date';
  key: PastDateFieldKey;
}

interface YearField extends PastKeyDatesFieldConfigBase {
  kind: 'year';
  key: 'lastAuditFiscalYear';
}

interface MonthYearField extends PastKeyDatesFieldConfigBase {
  kind: 'month-year';
  key: 'lastCompensationStudy';
}

export type PastKeyDatesFieldConfig = DateField | YearField | MonthYearField;

export const PAST_KEY_DATES_FIELD_CONFIG: Record<PastKeyDatesVariant, PastKeyDatesFieldConfig[]> = {
  'chapter12-standing': [
    {
      key: 'pastBackgroundQuestion',
      displayLabel: 'Last Update to Background Questionnaire',
      formLabel: 'Last Update to Background Questionnaire',
      testId: 'past-background-question-row',
      inputId: 'past-background-question',
      kind: 'date',
    },
    {
      key: 'pastAudit',
      displayLabel: 'Audit Report',
      formLabel: 'Audit Report Date',
      testId: 'past-audit-row',
      inputId: 'past-audit',
      kind: 'date',
    },
    {
      key: 'lastAuditFiscalYear',
      displayLabel: "Last Audit's Fiscal Year",
      formLabel: "Last Audit's Fiscal Year",
      testId: 'past-last-audit-fiscal-year-row',
      inputId: 'last-audit-fiscal-year',
      kind: 'year',
    },
  ],
  'chapter11-subv': [
    {
      key: 'lastMonthlyReportReceived',
      displayLabel: 'Last Monthly Report Received',
      formLabel: 'Last Monthly Report Received',
      testId: 'past-last-monthly-report-received-row',
      inputId: 'past-last-monthly-report-received',
      kind: 'date',
      stacked: true,
    },
  ],
  'chapter13-standing': [
    {
      key: 'pastBackgroundQuestion',
      displayLabel: 'Last Update to Background Questionnaire',
      formLabel: 'Last Update to Background Questionnaire',
      testId: 'past-background-question-row',
      inputId: 'past-background-question',
      kind: 'date',
    },
    {
      key: 'pastAudit',
      displayLabel: 'Audit Report',
      formLabel: 'Audit Report Date',
      testId: 'past-audit-row',
      inputId: 'past-audit',
      kind: 'date',
    },
    {
      key: 'lastCompensationStudy',
      displayLabel: 'Last Compensation Study',
      formLabel: 'Last Compensation Study',
      displayNote: '(Required every 5 years)',
      testId: 'last-compensation-study-row',
      inputId: 'last-compensation-study',
      kind: 'month-year',
    },
    {
      key: 'pastTprSubmission',
      displayLabel: 'Last TPR Submitted',
      formLabel: 'Last TPR Submitted',
      testId: 'last-tpr-submitted-row',
      inputId: 'last-tpr-submitted',
      kind: 'date',
    },
  ],
};
