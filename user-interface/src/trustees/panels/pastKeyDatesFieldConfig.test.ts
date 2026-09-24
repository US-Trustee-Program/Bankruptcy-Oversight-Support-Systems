import { describe, test, expect } from 'vitest';
import {
  PAST_KEY_DATES_FIELD_CONFIG,
  PAST_KEY_DATES_VARIANT_LABELS,
} from './pastKeyDatesFieldConfig';

describe('PAST_KEY_DATES_FIELD_CONFIG chapter12-standing variant', () => {
  const config = PAST_KEY_DATES_FIELD_CONFIG['chapter12-standing'];

  test('contains exactly the expected fields', () => {
    expect(config.map((f) => f.key)).toEqual([
      'pastBackgroundQuestion',
      'pastAudit',
      'lastAuditFiscalYear',
    ]);
  });

  test('pastBackgroundQuestion is configured as Last Update to Background Questionnaire', () => {
    expect(config.find((f) => f.key === 'pastBackgroundQuestion')).toMatchObject({
      displayLabel: 'Last Update to Background Questionnaire',
      formLabel: 'Last Update to Background Questionnaire',
      testId: 'past-background-question-row',
      inputId: 'past-background-question',
      kind: 'date',
    });
  });

  test('pastAudit has a formLabel distinct from its displayLabel', () => {
    expect(config.find((f) => f.key === 'pastAudit')).toMatchObject({
      displayLabel: 'Audit Report',
      formLabel: 'Audit Report Date',
      testId: 'past-audit-row',
      inputId: 'past-audit',
      kind: 'date',
    });
  });

  test('lastAuditFiscalYear is configured as a year field', () => {
    expect(config.find((f) => f.key === 'lastAuditFiscalYear')).toMatchObject({
      displayLabel: "Last Audit's Fiscal Year",
      formLabel: "Last Audit's Fiscal Year",
      testId: 'past-last-audit-fiscal-year-row',
      inputId: 'last-audit-fiscal-year',
      kind: 'year',
    });
  });
});

describe('PAST_KEY_DATES_FIELD_CONFIG subv-pool variant', () => {
  const config = PAST_KEY_DATES_FIELD_CONFIG['subv-pool'];

  test('contains exactly the expected fields', () => {
    expect(config.map((f) => f.key)).toEqual(['lastMonthlyReportReceived']);
  });

  test('lastMonthlyReportReceived is stacked', () => {
    expect(config.find((f) => f.key === 'lastMonthlyReportReceived')).toMatchObject({
      displayLabel: 'Last Monthly Report Received',
      formLabel: 'Last Monthly Report Received',
      testId: 'past-last-monthly-report-received-row',
      inputId: 'past-last-monthly-report-received',
      kind: 'date',
      stacked: true,
    });
  });
});

describe('PAST_KEY_DATES_FIELD_CONFIG chapter13-standing variant', () => {
  const config = PAST_KEY_DATES_FIELD_CONFIG['chapter13-standing'];

  test('contains exactly the expected fields', () => {
    expect(config.map((f) => f.key)).toEqual([
      'pastBackgroundQuestion',
      'pastAudit',
      'lastCompensationStudy',
      'pastTprSubmission',
    ]);
  });

  test('pastBackgroundQuestion is configured as Last Update to Background Questionnaire', () => {
    expect(config.find((f) => f.key === 'pastBackgroundQuestion')).toMatchObject({
      displayLabel: 'Last Update to Background Questionnaire',
      formLabel: 'Last Update to Background Questionnaire',
      testId: 'past-background-question-row',
      inputId: 'past-background-question',
      kind: 'date',
    });
  });

  test('pastAudit has a formLabel distinct from its displayLabel', () => {
    expect(config.find((f) => f.key === 'pastAudit')).toMatchObject({
      displayLabel: 'Audit Report',
      formLabel: 'Audit Report Date',
      testId: 'past-audit-row',
      inputId: 'past-audit',
      kind: 'date',
    });
  });

  test('lastCompensationStudy is configured as a month-year field with a recurrence note', () => {
    expect(config.find((f) => f.key === 'lastCompensationStudy')).toMatchObject({
      displayLabel: 'Last Compensation Study',
      formLabel: 'Last Compensation Study',
      displayNote: '(Required every 5 years)',
      testId: 'last-compensation-study-row',
      inputId: 'last-compensation-study',
      kind: 'month-year',
    });
  });

  test('includes pastTprSubmission configured as Last TPR Submitted', () => {
    const field = config.find((f) => f.key === 'pastTprSubmission');
    expect(field).toMatchObject({
      key: 'pastTprSubmission',
      displayLabel: 'Last TPR Submitted',
      formLabel: 'Last TPR Submitted',
      testId: 'last-tpr-submitted-row',
      inputId: 'last-tpr-submitted',
      kind: 'date',
    });
  });
});

describe('PAST_KEY_DATES_VARIANT_LABELS', () => {
  test('subv-pool uses an "Other" card title', () => {
    expect(PAST_KEY_DATES_VARIANT_LABELS['subv-pool']).toEqual({
      cardTitle: 'Other',
      editHeading: 'Edit Other Key Dates',
    });
  });

  test('chapter12-standing and chapter13-standing use the default Past Key Dates labels', () => {
    expect(PAST_KEY_DATES_VARIANT_LABELS['chapter12-standing']).toEqual({
      cardTitle: 'Past Key Dates',
      editHeading: 'Edit Past Key Dates',
    });
    expect(PAST_KEY_DATES_VARIANT_LABELS['chapter13-standing']).toEqual({
      cardTitle: 'Past Key Dates',
      editHeading: 'Edit Past Key Dates',
    });
  });
});
