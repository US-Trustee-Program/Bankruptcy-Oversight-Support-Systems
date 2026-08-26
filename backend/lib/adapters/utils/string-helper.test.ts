import { formatCityStateZipCountry, removeExtraSpaces } from './string-helper';

describe('Test string helper', () => {
  test('Should remove extra spaces from string', () => {
    const testString = `This       is
    \ta       test`;
    const expectedString = 'This is a test';

    const result = removeExtraSpaces(testString);
    expect(result).toEqual(expectedString);
  });

  test('Should return undefined when undefined is passed in', () => {
    const testString = undefined;

    const result = removeExtraSpaces(testString);
    expect(result).toBeUndefined();
  });
});

describe('Test formatCityStateZipCountry', () => {
  test('Should join city, state, zip, and country with a single space', () => {
    const result = formatCityStateZipCountry('Corinth', 'MS', '38834', 'USA');
    expect(result).toEqual('Corinth MS 38834 USA');
  });

  test.each([
    { city: undefined, state: 'MS', zip: '38834', country: 'USA', expected: 'MS 38834 USA' },
    {
      city: 'Corinth',
      state: undefined,
      zip: '38834',
      country: 'USA',
      expected: 'Corinth 38834 USA',
    },
    { city: 'Corinth', state: 'MS', zip: undefined, country: 'USA', expected: 'Corinth MS USA' },
    {
      city: 'Corinth',
      state: 'MS',
      zip: '38834',
      country: undefined,
      expected: 'Corinth MS 38834',
    },
    { city: '', state: 'MS', zip: '38834', country: 'USA', expected: 'MS 38834 USA' },
  ])(
    'Should omit a missing or blank field without leaving gaps ($city|$state|$zip|$country)',
    ({ city, state, zip, country, expected }) => {
      const result = formatCityStateZipCountry(city, state, zip, country);
      expect(result).toEqual(expected);
    },
  );

  test('Should collapse extra internal whitespace from any field', () => {
    const result = formatCityStateZipCountry('  Corinth  ', 'MS', '38834', 'USA');
    expect(result).toEqual('Corinth MS 38834 USA');
  });

  test('Should return undefined when all fields are missing', () => {
    const result = formatCityStateZipCountry(undefined, undefined, undefined, undefined);
    expect(result).toBeUndefined();
  });
});
