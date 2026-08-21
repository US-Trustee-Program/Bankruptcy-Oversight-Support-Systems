export type PastKeyDatesVariant = 'chapter7-panel' | 'subv-pool' | 'chapter12-standing';

export type PastDateFieldKey =
  | 'pastBackgroundQuestion'
  | 'pastFieldExam'
  | 'pastAudit'
  | 'pastTprSubmission'
  | 'lastMonthlyReportReceived';

interface PastKeyDatesFieldConfigBase {
  /** Label shown on the read-only Past Key Dates display card. */
  displayLabel: string;
  /** Label shown on the Edit Past Key Dates form. Differs from displayLabel for pastTprSubmission. */
  formLabel: string;
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

export type PastKeyDatesFieldConfig = DateField | YearField;

export const PAST_KEY_DATES_FIELD_CONFIG: Record<PastKeyDatesVariant, PastKeyDatesFieldConfig[]> = {
  'chapter7-panel': [
    {
      key: 'pastBackgroundQuestion',
      displayLabel: 'Last Update to Background Questionnaire',
      formLabel: 'Last Update to Background Questionnaire',
      testId: 'past-background-question-row',
      inputId: 'past-background-question',
      kind: 'date',
    },
    {
      key: 'pastFieldExam',
      displayLabel: 'Field Exam Report Date',
      formLabel: 'Field Exam Report Date',
      testId: 'past-field-exam-row',
      inputId: 'past-field-exam',
      kind: 'date',
    },
    {
      key: 'pastAudit',
      displayLabel: 'Audit Report Date',
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
    {
      key: 'pastTprSubmission',
      displayLabel: 'TIR Letter',
      formLabel: 'Trustee Interim Report Letter Date',
      testId: 'past-tpr-submission-row',
      inputId: 'past-tpr-submission',
      kind: 'date',
    },
  ],
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
  'subv-pool': [
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
};
