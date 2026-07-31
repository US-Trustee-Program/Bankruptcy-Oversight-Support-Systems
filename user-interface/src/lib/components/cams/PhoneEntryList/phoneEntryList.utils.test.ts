import { validateTypedPhones } from './phoneEntryList.utils';

describe('validateTypedPhones', () => {
  test('returns no errors for an empty list', () => {
    expect(validateTypedPhones([])).toEqual({});
  });

  test('skips untouched rows (no number and no extension)', () => {
    const result = validateTypedPhones([{ type: 'direct', number: '', extension: '' }]);
    expect(result).toEqual({});
  });

  test('skips whitespace-only rows', () => {
    const result = validateTypedPhones([{ type: 'direct', number: '   ', extension: '   ' }]);
    expect(result).toEqual({});
  });

  test('returns number error for an invalid phone number', () => {
    const result = validateTypedPhones([{ type: 'direct', number: '123' }]);
    expect(result[0]).toBeDefined();
    expect(result[0].number).toEqual(expect.arrayContaining([expect.any(String)]));
  });

  test('returns no errors for a valid phone number', () => {
    const result = validateTypedPhones([{ type: 'direct', number: '555-111-2222' }]);
    expect(result).toEqual({});
  });

  test('returns extension error when extension is present without a phone number', () => {
    const result = validateTypedPhones([{ type: 'direct', number: '', extension: '123' }]);
    expect(result[0]).toBeDefined();
  });

  test('only records errors for the row with the invalid entry', () => {
    const result = validateTypedPhones([
      { type: 'direct', number: '555-111-2222' },
      { type: 'home', number: '123' },
    ]);
    expect(result[0]).toBeUndefined();
    expect(result[1]).toBeDefined();
    expect(result[1].number).toEqual(expect.arrayContaining([expect.any(String)]));
  });

  test('records errors at the correct index when the first row is invalid', () => {
    const result = validateTypedPhones([
      { type: 'direct', number: 'bad' },
      { type: 'home', number: '555-333-4444' },
    ]);
    expect(result[0]).toBeDefined();
    expect(result[1]).toBeUndefined();
  });
});
