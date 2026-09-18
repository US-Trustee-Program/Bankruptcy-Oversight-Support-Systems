import { describe, test, expect } from 'vitest';
import { PAST_KEY_DATES_FIELD_CONFIG } from './pastKeyDatesFieldConfig';

describe('PAST_KEY_DATES_FIELD_CONFIG chapter7-elected variant', () => {
  const config = PAST_KEY_DATES_FIELD_CONFIG['chapter7-elected'];

  test('has exactly one field: bondIssuedDate', () => {
    expect(config).toHaveLength(1);
    expect(config[0].key).toBe('bondIssuedDate');
  });

  test('bondIssuedDate field is configured to match the Bond Issued Date spec', () => {
    const field = config.find((f) => f.key === 'bondIssuedDate');
    expect(field).toMatchObject({
      key: 'bondIssuedDate',
      displayLabel: 'Bond Issued',
      formLabel: 'Bond Issued Date',
      testId: 'bond-issued-date-row',
      inputId: 'bond-issued-date',
      kind: 'date',
    });
  });
});

describe('PAST_KEY_DATES_FIELD_CONFIG chapter13-standing variant', () => {
  const config = PAST_KEY_DATES_FIELD_CONFIG['chapter13-standing'];

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

  test('does not change the chapter7-panel pastTprSubmission entry (TIR Letter)', () => {
    const chapter7PanelConfig = PAST_KEY_DATES_FIELD_CONFIG['chapter7-panel'];
    const field = chapter7PanelConfig.find((f) => f.key === 'pastTprSubmission');
    expect(field).toMatchObject({
      displayLabel: 'TIR Letter',
      formLabel: 'Trustee Interim Report Letter Date',
    });
  });
});
