import { removeExtraSpaces } from './string-helper';

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
