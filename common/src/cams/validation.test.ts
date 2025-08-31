import V, { ValidationSpec } from './validation';

type Person = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  code: string;
};

const { validResult } = V;
const invalidResult = expect.objectContaining({ valid: false });

describe('validation', () => {
  describe('isString', () => {
    const testCases = [
      {
        description: 'should return valid for string values',
        value: 'hello',
        expected: validResult,
      },
      {
        description: 'should return invalid for number values',
        value: 123,
        expected: { valid: false, reasons: ['Must be a string'] },
      },
      {
        description: 'should return invalid for boolean values',
        value: true,
        expected: { valid: false, reasons: ['Must be a string'] },
      },
      {
        description: 'should return invalid for null values',
        value: null,
        expected: { valid: false, reasons: ['Must be a string'] },
      },
      {
        description: 'should return invalid for undefined values',
        value: undefined,
        expected: { valid: false, reasons: ['Must be a string'] },
      },
      {
        description: 'should return valid for empty string',
        value: '',
        expected: validResult,
      },
    ];
    test.each(testCases)('$description', (testCase) => {
      expect(V.isString(testCase.value)).toEqual(testCase.expected);
    });
  });

  describe('minLength', () => {
    const testCases = [
      {
        description: 'should return valid for string meeting minimum length',
        minLength: 5,
        value: 'hello',
        expected: validResult,
      },
      {
        description: 'should return valid for string exactly at minimum length',
        minLength: 5,
        value: 'hello',
        expected: validResult,
      },
      {
        description: 'should return invalid for string shorter than minimum length',
        minLength: 10,
        value: 'hello',
        expected: { valid: false, reasons: ['Must contain at least 10 characters'] },
      },
      {
        description: 'should return invalid for empty string when minimum is greater than 0',
        minLength: 1,
        value: '',
        expected: { valid: false, reasons: ['Must contain at least 1 characters'] },
      },
      {
        description: 'should return valid for empty string when minimum is 0',
        minLength: 0,
        value: '',
        expected: validResult,
      },
      {
        description: 'should return invalid for non-string values',
        minLength: 3,
        value: 123,
        expected: { valid: false, reasons: ['Value does not have a length'] },
      },
    ];
    test.each(testCases)('$description', (testCase) => {
      const validator = V.minLength(testCase.minLength);
      expect(validator(testCase.value)).toEqual(testCase.expected);
    });
  });

  describe('maxLength', () => {
    const testCases = [
      {
        description: 'should return valid for string under maximum length',
        maxLength: 10,
        value: 'hello',
        expected: validResult,
      },
      {
        description: 'should return valid for string exactly at maximum length',
        maxLength: 5,
        value: 'hello',
        expected: validResult,
      },
      {
        description: 'should return invalid for string longer than maximum length',
        maxLength: 4,
        value: 'hello',
        expected: { valid: false, reasons: ['Must contain at most 4 characters'] },
      },
      {
        description: 'should return valid for empty string',
        maxLength: 5,
        value: '',
        expected: validResult,
      },
      {
        description: 'should return invalid for non-string values',
        maxLength: 5,
        value: 123,
        expected: { valid: false, reasons: ['Value does not have a length'] },
      },
      {
        description: 'should return invalid for null values',
        maxLength: 5,
        value: null,
        expected: { valid: false, reasons: ['Value is null'] },
      },
    ];
    test.each(testCases)('$description', (testCase) => {
      const validator = V.maxLength(testCase.maxLength);
      expect(validator(testCase.value)).toEqual(testCase.expected);
    });
  });

  describe('length', () => {
    const testCases = [
      {
        description: 'should return valid for string within length bounds',
        min: 2,
        max: 10,
        value: 'hello',
        expected: validResult,
      },
      {
        description: 'should return valid for string at minimum length',
        min: 5,
        max: 10,
        value: 'hello',
        expected: validResult,
      },
      {
        description: 'should return valid for string at maximum length',
        min: 2,
        max: 5,
        value: 'hello',
        expected: validResult,
      },
      {
        description: 'should return invalid for string shorter than minimum',
        min: 10,
        max: 15,
        value: 'hello',
        expected: { valid: false, reasons: ['Must contain between 10 and 15 characters'] },
      },
      {
        description: 'should return invalid for string longer than maximum',
        min: 1,
        max: 3,
        value: 'hello',
        expected: { valid: false, reasons: ['Must contain between 1 and 3 characters'] },
      },
      {
        description: 'should return valid for array within length bounds',
        min: 2,
        max: 5,
        value: ['a', 'b', 'c'],
        expected: validResult,
      },
      {
        description: 'should return invalid for array shorter than minimum',
        min: 5,
        max: 10,
        value: ['a', 'b'],
        expected: { valid: false, reasons: ['Must contain between 5 and 10 selections'] },
      },
      {
        description: 'should return invalid for array longer than maximum',
        min: 1,
        max: 2,
        value: ['a', 'b', 'c'],
        expected: { valid: false, reasons: ['Must contain between 1 and 2 selections'] },
      },
      {
        description: 'should return invalid for non-string, non-array values',
        min: 1,
        max: 5,
        value: 123,
        expected: { valid: false, reasons: ['Value does not have a length'] },
      },
      {
        description: 'should return invalid for null values',
        min: 1,
        max: 5,
        value: null,
        expected: { valid: false, reasons: ['Value is null'] },
      },
      {
        description: 'should return invalid for undefined values',
        min: 1,
        max: 5,
        value: undefined,
        expected: { valid: false, reasons: ['Value is undefined'] },
      },
    ];
    test.each(testCases)('$description', (testCase) => {
      const validator = V.length(testCase.min, testCase.max);
      expect(validator(testCase.value)).toEqual(testCase.expected);
    });
  });

  describe('matches', () => {
    const testCases = [
      {
        description: 'should return valid for string matching regex pattern',
        regex: /^[a-z]+$/,
        value: 'hello',
        expected: validResult,
      },
      {
        description: 'should return invalid for string not matching regex pattern',
        regex: /^[a-z]+$/,
        value: 'Hello123',
        expected: { valid: false, reasons: ['Must match the pattern /^[a-z]+$/'] },
      },
      {
        description: 'should use custom error message when provided',
        regex: /^\d+$/,
        error: 'Must be only digits',
        value: 'abc',
        expected: { valid: false, reasons: ['Must be only digits'] },
      },
      {
        description: 'should return valid for string matching digit pattern',
        regex: /^\d+$/,
        value: '12345',
        expected: validResult,
      },
      {
        description: 'should return invalid for empty string when pattern requires content',
        regex: /^.+$/,
        value: '',
        expected: { valid: false, reasons: ['Must match the pattern /^.+$/'] },
      },
      {
        description: 'should return invalid for non-string values',
        regex: /^[a-z]+$/,
        value: 123,
        expected: { valid: false, reasons: ['Must match the pattern /^[a-z]+$/'] },
      },
    ];
    test.each(testCases)('$description', (testCase) => {
      const validator = V.matches(testCase.regex, testCase.error);
      expect(validator(testCase.value)).toEqual(testCase.expected);
    });
  });

  describe('isEmailAddress', () => {
    const testCases = [
      {
        description: 'should return valid for properly formatted email',
        value: 'test@example.com',
        expected: validResult,
      },
      {
        description: 'should return valid for email with subdomain',
        value: 'user@mail.example.com',
        expected: validResult,
      },
      {
        description: 'should return valid for email with numbers',
        value: 'user123@example123.com',
        expected: validResult,
      },
      {
        description: 'should return invalid for email without @ symbol',
        value: 'userexample.com',
        expected: { valid: false, reasons: ['Must be a valid email address'] },
      },
      {
        description: 'should return invalid for email without domain',
        value: 'user@',
        expected: { valid: false, reasons: ['Must be a valid email address'] },
      },
      {
        description: 'should return invalid for email without username',
        value: '@example.com',
        expected: { valid: false, reasons: ['Must be a valid email address'] },
      },
      {
        description: 'should return invalid for email with spaces',
        value: 'user @example.com',
        expected: { valid: false, reasons: ['Must be a valid email address'] },
      },
      {
        description: 'should return invalid for empty string',
        value: '',
        expected: { valid: false, reasons: ['Must be a valid email address'] },
      },
      {
        description: 'should return invalid for non-string values',
        value: 123,
        expected: { valid: false, reasons: ['Must be a valid email address'] },
      },
    ];
    test.each(testCases)('$description', (testCase) => {
      expect(V.isEmailAddress(testCase.value)).toEqual(testCase.expected);
    });
  });

  describe('isPhoneNumber', () => {
    const testCases = [
      {
        description: 'should return valid for 10-digit phone number',
        value: '1234567890',
        expected: validResult,
      },
      {
        description: 'should return valid for another 10-digit phone number',
        value: '9876543210',
        expected: validResult,
      },
      {
        description: 'should return invalid for phone number with less than 10 digits',
        value: '123456789',
        expected: { valid: false, reasons: ['Must be a valid phone number'] },
      },
      {
        description: 'should return invalid for phone number with more than 10 digits',
        value: '12345678901',
        expected: { valid: false, reasons: ['Must be a valid phone number'] },
      },
      {
        description: 'should return invalid for phone number with dashes',
        value: '123-456-7890',
        expected: { valid: false, reasons: ['Must be a valid phone number'] },
      },
      {
        description: 'should return invalid for phone number with spaces',
        value: '123 456 7890',
        expected: { valid: false, reasons: ['Must be a valid phone number'] },
      },
      {
        description: 'should return invalid for phone number with parentheses',
        value: '(123) 456-7890',
        expected: { valid: false, reasons: ['Must be a valid phone number'] },
      },
      {
        description: 'should return invalid for phone number with letters',
        value: 'abc',
        expected: { valid: false, reasons: ['Must be a valid phone number'] },
      },
      {
        description: 'should return invalid for empty string',
        value: '',
        expected: { valid: false, reasons: ['Must be a valid phone number'] },
      },
      {
        description: 'should return invalid for non-string values',
        value: 1234567890,
        expected: { valid: false, reasons: ['Must be a valid phone number'] },
      },
    ];
    test.each(testCases)('$description', (testCase) => {
      expect(V.isPhoneNumber(testCase.value)).toEqual(testCase.expected);
    });
  });

  describe('isInSet', () => {
    const testCases = [
      {
        description: 'should return valid for value in allowed set',
        set: ['red', 'green', 'blue'],
        value: 'red',
        expected: validResult,
      },
      {
        description: 'should return valid for another value in allowed set',
        set: ['cat', 'dog', 'bird'],
        value: 'dog',
        expected: validResult,
      },
      {
        description: 'should return invalid for value not in allowed set',
        set: ['red', 'green', 'blue'],
        value: 'yellow',
        expected: { valid: false, reasons: ['Must be one of red, green, blue'] },
      },
      {
        description: 'should return invalid for case-sensitive mismatch',
        set: ['red', 'green', 'blue'],
        value: 'Red',
        expected: { valid: false, reasons: ['Must be one of red, green, blue'] },
      },
      {
        description: 'should use custom reason when provided',
        set: ['a', 'b', 'c'],
        reason: 'Must be a valid option',
        value: 'd',
        expected: { valid: false, reasons: ['Must be a valid option'] },
      },
      {
        description: 'should return invalid for empty string when not in set',
        set: ['red', 'green', 'blue'],
        value: '',
        expected: { valid: false, reasons: ['Must be one of red, green, blue'] },
      },
      {
        description: 'should return valid for empty string if in set',
        set: ['', 'red', 'green'],
        value: '',
        expected: validResult,
      },
      {
        description: 'should return invalid for non-string values',
        set: ['red', 'green', 'blue'],
        value: 123,
        expected: { valid: false, reasons: ['Must be one of red, green, blue'] },
      },
      {
        description: 'should return invalid for null values',
        set: ['red', 'green', 'blue'],
        value: null,
        expected: { valid: false, reasons: ['Must be one of red, green, blue'] },
      },
    ];
    test.each(testCases)('$description', (testCase) => {
      const validator = V.isInSet(testCase.set, testCase.reason);
      expect(validator(testCase.value)).toEqual(testCase.expected);
    });
  });

  describe('nullable', () => {
    type NullableName = {
      name: string | null;
    };

    const spec: ValidationSpec<NullableName> = {
      name: [V.nullable(V.isString, V.minLength(2))],
    };

    const testCases = [
      { obj: { name: 'John' }, expected: validResult },
      { obj: { name: null }, expected: validResult },
      { obj: {}, expected: invalidResult },
    ];

    test.each(testCases)('should handle nullable values for $obj.name', (testCase) => {
      expect(V.validateObject(spec, testCase.obj)).toEqual(testCase.expected);
    });
  });

  describe('optional', () => {
    type OptionalName = {
      name?: string;
    };

    const spec: ValidationSpec<OptionalName> = {
      name: [V.optional(V.isString, V.minLength(2))],
    };

    const testCases = [
      { obj: { name: 'John' }, expected: validResult },
      { obj: { name: null }, expected: invalidResult },
      { obj: {}, expected: validResult },
    ];

    test.each(testCases)('should handle optional values for $obj.name', (testCase) => {
      expect(V.validateObject(spec, testCase.obj)).toEqual(testCase.expected);
    });
  });

  describe('validate', () => {
    const testCases = [
      {
        description: 'should return valid result when validator passes',
        validator: V.isString,
        value: 'hello',
        expected: validResult,
      },
      {
        description: 'should return invalid result when validator fails',
        validator: V.isString,
        value: 123,
        expected: { valid: false, reasons: ['Must be a string'] },
      },
      {
        description: 'should work with factory validator functions',
        validator: V.minLength(5),
        value: 'hello world',
        expected: validResult,
      },
      {
        description: 'should return failure for factory validator functions',
        validator: V.minLength(10),
        value: 'short',
        expected: { valid: false, reasons: ['Must contain at least 10 characters'] },
      },
    ];
    test.each(testCases)('$description', (testCase) => {
      expect(V.validate(testCase.validator, testCase.value)).toEqual(testCase.expected);
    });
  });

  describe('validateEach', () => {
    const testCases = [
      {
        description: 'should return valid when all validators pass',
        validators: [V.isString, V.minLength(3)],
        value: 'hello',
        expected: validResult,
      },
      {
        description: 'should return invalid with single reason when one validator fails',
        validators: [V.isString, V.minLength(10)],
        value: 'hello',
        expected: { valid: false, reasons: ['Must contain at least 10 characters'] },
      },
      {
        description: 'should return invalid with multiple reasons when multiple validators fail',
        validators: [V.minLength(10), V.maxLength(3)],
        value: 'hello',
        expected: {
          valid: false,
          reasons: ['Must contain at least 10 characters', 'Must contain at most 3 characters'],
        },
      },
      {
        description: 'should work with mix of direct and factory validators',
        validators: [V.isString, V.length(3, 10), V.matches(/^[a-z]+$/)],
        value: 'hello',
        expected: validResult,
      },
      {
        description: 'should accumulate all failure reasons',
        validators: [V.isString, V.minLength(10), V.matches(/^\d+$/)],
        value: 'hello',
        expected: {
          valid: false,
          reasons: ['Must contain at least 10 characters', 'Must match the pattern /^\\d+$/'],
        },
      },
      {
        description: 'should handle empty validator array',
        validators: [],
        value: 'anything',
        expected: validResult,
      },
      {
        description: 'should handle single validator',
        validators: [V.isEmailAddress],
        value: 'test@example.com',
        expected: validResult,
      },
      {
        description: 'should handle single failing validator',
        validators: [V.isEmailAddress],
        value: 'invalid-email',
        expected: { valid: false, reasons: ['Must be a valid email address'] },
      },
    ];
    test.each(testCases)('$description', (testCase) => {
      expect(V.validateEach(testCase.validators, testCase.value)).toEqual(testCase.expected);
    });
  });

  describe('validateKey', () => {
    test('should return valid when key validation passes', () => {
      const spec = { name: [V.isString, V.minLength(2)] };
      const obj = { name: 'John' };
      expect(V.validateKey(spec, 'name', obj)).toEqual(validResult);
    });

    test('should return invalid with reasons when key validation fails', () => {
      const spec = { name: [V.isString, V.minLength(5)] };
      const obj = { name: 'Jo' };
      expect(V.validateKey(spec, 'name', obj)).toEqual({
        valid: false,
        reasons: ['Must contain at least 5 characters'],
      });
    });

    test('should handle multiple validators with multiple failures', () => {
      const spec = { name: [V.minLength(10), V.matches(/^\d+$/)] };
      const obj = { name: 'John' };
      expect(V.validateKey(spec, 'name', obj)).toEqual({
        valid: false,
        reasons: ['Must contain at least 10 characters', 'Must match the pattern /^\\d+$/'],
      });
    });

    test('should validate email key correctly', () => {
      const spec = { email: [V.isEmailAddress] };
      const obj = { email: 'test@example.com' };
      expect(V.validateKey(spec, 'email', obj)).toEqual(validResult);
    });

    test('should return invalid for bad email format', () => {
      const spec = { email: [V.isEmailAddress] };
      const obj = { email: 'invalid-email' };
      expect(V.validateKey(spec, 'email', obj)).toEqual({
        valid: false,
        reasons: ['Must be a valid email address'],
      });
    });

    test('should handle single validator successfully', () => {
      const spec = { name: [V.isString] };
      const obj = { name: 'Alice' };
      expect(V.validateKey(spec, 'name', obj)).toEqual(validResult);
    });
  });

  describe('validateObject', () => {
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
            firstName: { valid: false, reasons: ['Must contain at least 1 characters'] },
            lastName: { valid: false, reasons: ['Must contain between 1 and 100 characters'] },
            email: { valid: false, reasons: ['Must be a valid email address'] },
            phone: { valid: false, reasons: ['Must be a valid phone number'] },
            code: { valid: false, reasons: ['Must be one of a, b'] },
          },
        },
      },
    ];
    test.each(testCases)('$description', (testCase) => {
      expect(V.validateObject(spec, testCase.obj)).toEqual(
        expect.objectContaining(testCase.expected),
      );
    });
  });
});
