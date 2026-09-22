import { describe, test, expect } from 'vitest';
import { PAST_KEY_DATES_FIELD_CONFIG } from './pastKeyDatesFieldConfig';

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
});
