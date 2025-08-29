import V, { ValidationSpec } from './validation';

describe('validation', () => {
  describe('isString', () => {});
  describe('minLength', () => {});
  describe('maxLength', () => {});
  describe('length', () => {});
  describe('matches', () => {});
  describe('isEmailAddress', () => {});
  describe('isPhoneNumber', () => {});
  describe('isInSet', () => {});

  describe('validate', () => {});
  describe('validateEach', () => {});
  describe('validateKey', () => {});
  describe('validateObject', () => {
    type Person = {
      firstName: string;
      lastName: string;
      email: string;
      phone: string;
      code: string;
    };

    const validCodes = ['a', 'b'];
    const spec: ValidationSpec<Person> = {
      firstName: [V.isString, V.minLength(1)],
      lastName: [V.isString, V.length(1, 100)],
      phone: [V.isPhoneNumber],
      email: [V.isEmailAddress],
      code: [V.isInSet(validCodes)],
    };

    const testCases = [
      {
        description: 'should validate a valid object',
        obj: {
          firstName: 'John',
          lastName: 'Doe',
          email: 'john@doe.com',
          phone: '1234567890',
          code: 'a',
        },
        expected: {
          valid: true,
        },
      },
      {
        description: 'should validate a invalid object',
        obj: {
          firstName: '',
          lastName: '',
          email: '',
          phone: '',
          code: 'c',
        },
        expected: {
          valid: false,
          reasons: {
            firstName: { valid: false, reasons: ['Must be at least 1 characters long'] },
            lastName: { valid: false, reasons: ['Must be between 1 and 100 characters long'] },
            email: { valid: false, reasons: ['Must be a valid email address'] },
            phone: { valid: false, reasons: ['Must be a valid phone number'] },
            code: { valid: false, reasons: ['Must be one of a, b'] },
          },
        },
      },
    ];
    test.each(testCases)('$.description', (testCase) => {
      expect(V.validateObject(spec, testCase.obj)).toEqual(
        expect.objectContaining(testCase.expected),
      );
    });
  });
});
