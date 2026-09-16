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
