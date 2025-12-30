import { describe, test, expect } from 'vitest';
import { ValidationSpec, validateObject, VALID, ValidatorResult } from './validation';
import Validators from './validators';

type TestPerson = {
  name?: string;
  email?: string;
  phone?: string;
  code?: string;
  profile?: { age: number; city: string };
};

describe('validators', () => {
  describe('minLength', () => {
    const testCases = [
      {
        description: 'should return valid for string exactly at minimum length',
        minLength: 5,
        value: 'hello',
        expected: VALID,
      },
      {
        description: 'should return invalid for string one character shorter than minimum length',
        minLength: 6,
        value: 'hello',
        expected: { reasons: ['Must contain at least 6 characters'] },
      },
      {
        description: 'should return invalid for empty string when minimum is greater than 0',
        minLength: 1,
        value: '',
        expected: { reasons: ['Must contain at least 1 characters'] },
      },
      {
        description: 'should return valid for empty string when minimum is 0',
        minLength: 0,
        value: '',
        expected: VALID,
      },
      {
        description: 'should return invalid for non-string values',
        minLength: 3,
        value: 123,
        expected: { reasons: ['Value does not have a length'] },
      },
    ];
    test.each(testCases)('$description', (testCase) => {
      const validator = Validators.minLength(testCase.minLength);
      expect(validator(testCase.value)).toEqual(testCase.expected);
    });
  });

  describe('maxLength', () => {
    const testCases = [
      {
        description: 'should return valid for string exactly at maximum length',
        maxLength: 5,
        value: 'hello',
        expected: VALID,
      },
      {
        description: 'should return invalid for string longer than maximum length',
        maxLength: 4,
        value: 'hello',
        expected: { reasons: ['Must contain at most 4 characters'] },
      },
      {
        description: 'should return valid for empty string',
        maxLength: 5,
        value: '',
        expected: VALID,
      },
      {
        description: 'should return invalid for non-string values',
        maxLength: 5,
        value: 123,
        expected: { reasons: ['Value does not have a length'] },
      },
      {
        description: 'should return invalid for null values',
        maxLength: 5,
        value: null,
        expected: { reasons: ['Value is null'] },
      },
    ];
    test.each(testCases)('$description', (testCase) => {
      const validator = Validators.maxLength(testCase.maxLength);
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
        expected: VALID,
      },
      {
        description: 'should return valid for string at minimum length',
        min: 5,
        max: 10,
        value: 'hello',
        expected: VALID,
      },
      {
        description: 'should return valid for string at maximum length',
        min: 2,
        max: 5,
        value: 'hello',
        expected: VALID,
      },
      {
        description: 'should return invalid for string one character shorter than minimum length',
        min: 6,
        max: 10,
        value: 'hello',
        expected: { reasons: ['Must contain between 6 and 10 characters'] },
      },
      {
        description: 'should return invalid for string one character longer than maximum length',
        min: 2,
        max: 4,
        value: 'hello',
        expected: { reasons: ['Must contain between 2 and 4 characters'] },
      },
      {
        description: 'should return valid for array within length bounds',
        min: 2,
        max: 5,
        value: ['a', 'b', 'c'],
        expected: VALID,
      },
      {
        description: 'should return invalid for array shorter than minimum',
        min: 3,
        max: 10,
        value: ['a', 'b'],
        expected: { reasons: ['Must contain between 3 and 10 selections'] },
      },
      {
        description: 'should return invalid for array longer than maximum',
        min: 1,
        max: 2,
        value: ['a', 'b', 'c'],
        expected: { reasons: ['Must contain between 1 and 2 selections'] },
      },
      {
        description: 'should return invalid for non-string, non-array values',
        min: 1,
        max: 5,
        value: 123,
        expected: { reasons: ['Value does not have a length'] },
      },
      {
        description: 'should return invalid for null values',
        min: 1,
        max: 5,
        value: null,
        expected: { reasons: ['Value is null'] },
      },
      {
        description: 'should return invalid for undefined values',
        min: 1,
        max: 5,
        value: undefined,
        expected: { reasons: ['Value is undefined'] },
      },
    ];
    test.each(testCases)('$description', (testCase) => {
      const validator = Validators.length(testCase.min, testCase.max);
      expect(validator(testCase.value)).toEqual(testCase.expected);
    });
  });

  describe('matches', () => {
    const testCases = [
      {
        description: 'should return valid for string matching regex pattern',
        regex: /^[a-z]+$/,
        value: 'hello',
        expected: VALID,
      },
      {
        description: 'should return invalid for string not matching regex pattern',
        regex: /^[a-z]+$/,
        value: 'Hello123',
        expected: { reasons: ['Must match the pattern /^[a-z]+$/'] },
      },
      {
        description: 'should use custom error message when provided',
        regex: /^\d+$/,
        error: 'Must be only digits',
        value: 'abc',
        expected: { reasons: ['Must be only digits'] },
      },
      {
        description: 'should return valid for string matching digit pattern',
        regex: /^\d+$/,
        value: '12345',
        expected: VALID,
      },
      {
        description: 'should return invalid for empty string when pattern requires content',
        regex: /^.+$/,
        value: '',
        expected: { reasons: ['Must match the pattern /^.+$/'] },
      },
      {
        description: 'should return invalid for non-string values',
        regex: /^[a-z]+$/,
        value: 123,
        expected: { reasons: ['Must match the pattern /^[a-z]+$/'] },
      },
    ];
    test.each(testCases)('$description', (testCase) => {
      const validator = Validators.matches(testCase.regex, testCase.error);
      expect(validator(testCase.value)).toEqual(testCase.expected);
    });
  });

  describe('isEmailAddress', () => {
    const testCases = [
      {
        description: 'should return valid for properly formatted email',
        value: 'test@example.com',
        expected: VALID,
      },
      {
        description: 'should return valid for email with subdomain',
        value: 'user@mail.example.com',
        expected: VALID,
      },
      {
        description: 'should return valid for email with numbers',
        value: 'user123@example123.com',
        expected: VALID,
      },
      {
        description: 'should return invalid for email without @ symbol',
        value: 'userexample.com',
        expected: { reasons: ['Must be a valid email address'] },
      },
      {
        description: 'should return invalid for email without domain',
        value: 'user@',
        expected: { reasons: ['Must be a valid email address'] },
      },
      {
        description: 'should return invalid for email without username',
        value: '@example.com',
        expected: { reasons: ['Must be a valid email address'] },
      },
      {
        description: 'should return invalid for email with spaces',
        value: 'user @example.com',
        expected: { reasons: ['Must be a valid email address'] },
      },
      {
        description: 'should return invalid for empty string',
        value: '',
        expected: { reasons: ['Must be a valid email address'] },
      },
      {
        description: 'should return invalid for non-string values',
        value: 123,
        expected: { reasons: ['Must be a valid email address'] },
      },
    ];
    test.each(testCases)('$description', (testCase) => {
      expect(Validators.isEmailAddress(testCase.value)).toEqual(testCase.expected);
    });
  });

  describe('isPhoneNumber', () => {
    const testCases = [
      {
        description: 'should return valid for a hyphenated 10-digit phone number',
        value: '123-456-7890',
        expected: VALID,
      },
      {
        description: 'should return valid for another hyphenated 10-digit phone number',
        value: '987-654-3210',
        expected: VALID,
      },
      {
        description: 'should return invalid for phone number with less than 10 digits',
        value: '123456789',
        expected: { reasons: ['Must be a valid phone number'] },
      },
      {
        description: 'should return invalid for phone number with more than 10 digits',
        value: '12345678901',
        expected: { reasons: ['Must be a valid phone number'] },
      },
      {
        description: 'should return invalid for phone number with spaces',
        value: '123 456 7890',
        expected: { reasons: ['Must be a valid phone number'] },
      },
      {
        description: 'should return invalid for phone number with parentheses',
        value: '(123) 456-7890',
        expected: { reasons: ['Must be a valid phone number'] },
      },
      {
        description: 'should return invalid for phone number with letters',
        value: 'abc',
        expected: { reasons: ['Must be a valid phone number'] },
      },
      {
        description: 'should return invalid for empty string',
        value: '',
        expected: { reasons: ['Must be a valid phone number'] },
      },
      {
        description: 'should return invalid for non-string values',
        value: 1234567890,
        expected: { reasons: ['Must be a valid phone number'] },
      },
    ];
    test.each(testCases)('$description', (testCase) => {
      expect(Validators.isPhoneNumber(testCase.value)).toEqual(testCase.expected);
    });
  });

  describe('isWebsiteAddress', () => {
    const testCases = [
      {
        description: 'should return valid for properly formatted http website',
        value: 'http://www.example.com',
        expected: VALID,
      },
      {
        description: 'should return valid for properly formatted https website',
        value: 'https://www.example.com',
        expected: VALID,
      },
      {
        description: 'should return valid for website without www',
        value: 'https://example.com',
        expected: VALID,
      },
      {
        description: 'should return valid for website with subdomain',
        value: 'https://mail.example.com',
        expected: VALID,
      },
      {
        description: 'should return valid for website with path',
        value: 'https://www.example.com/path/to/page',
        expected: VALID,
      },
      {
        description: 'should return valid for website with query parameters',
        value: 'https://www.example.com/search?q=test&sort=name',
        expected: VALID,
      },
      {
        description: 'should return valid for website with fragment',
        value: 'https://www.example.com/page#section',
        expected: VALID,
      },
      {
        description: 'should return valid for website with port number',
        value: 'https://www.example.com:8080',
        expected: VALID,
      },
      {
        description: 'should return valid for Chapter 13 trustee website example',
        value: 'https://www.ch13-trustee.com',
        expected: VALID,
      },
      {
        description: 'should return valid for trustee website with hyphen',
        value: 'https://jane-smith-trustee.com',
        expected: VALID,
      },
      {
        description: 'should return invalid for website without protocol',
        value: 'www.example.com',
        expected: { reasons: ['Must be a valid website address'] },
      },
      {
        description: 'should return invalid for website with only protocol',
        value: 'https://',
        expected: { reasons: ['Must be a valid website address'] },
      },
      {
        description: 'should return invalid for website without domain',
        value: 'https://www',
        expected: { reasons: ['Must be a valid website address'] },
      },
      {
        description: 'should return invalid for website with invalid protocol',
        value: 'ftp://www.example.com',
        expected: { reasons: ['Must be a valid website address'] },
      },
      {
        description: 'should return invalid for website with spaces',
        value: 'https://www.example .com',
        expected: { reasons: ['Must be a valid website address'] },
      },
      {
        description: 'should return invalid for empty string',
        value: '',
        expected: { reasons: ['Must be a valid website address'] },
      },
      {
        description: 'should return invalid for non-string values',
        value: 123,
        expected: { reasons: ['Must be a valid website address'] },
      },
    ];
    test.each(testCases)('$description', (testCase) => {
      expect(Validators.isWebsiteAddress(testCase.value)).toEqual(testCase.expected);
    });
  });

  describe('isInSet', () => {
    const testCases = [
      {
        description: 'should return valid for value in allowed set',
        set: ['red', 'green', 'blue'],
        value: 'red',
        expected: VALID,
      },
      {
        description: 'should return valid for another value in allowed set',
        set: ['cat', 'dog', 'bird'],
        value: 'dog',
        expected: VALID,
      },
      {
        description: 'should return invalid for value not in allowed set',
        set: ['red', 'green', 'blue'],
        value: 'yellow',
        expected: { reasons: ['Must be one of red, green, blue'] },
      },
      {
        description: 'should return invalid for case-sensitive mismatch',
        set: ['red', 'green', 'blue'],
        value: 'Red',
        expected: { reasons: ['Must be one of red, green, blue'] },
      },
      {
        description: 'should use custom reason when provided',
        set: ['a', 'b', 'c'],
        reason: 'Must be a valid option',
        value: 'd',
        expected: { reasons: ['Must be a valid option'] },
      },
      {
        description: 'should return invalid for empty string when not in set',
        set: ['red', 'green', 'blue'],
        value: '',
        expected: { reasons: ['Must be one of red, green, blue'] },
      },
      {
        description: 'should return valid for empty string if in set',
        set: ['', 'red', 'green'],
        value: '',
        expected: VALID,
      },
      {
        description: 'should return invalid for non-string values',
        set: ['red', 'green', 'blue'],
        value: 123,
        expected: { reasons: ['Must be one of red, green, blue'] },
      },
      {
        description: 'should return invalid for null values',
        set: ['red', 'green', 'blue'],
        value: null,
        expected: { reasons: ['Must be one of red, green, blue'] },
      },
    ];
    test.each(testCases)('$description', (testCase) => {
      const validator = Validators.isInSet(testCase.set, testCase.reason);
      expect(validator(testCase.value)).toEqual(testCase.expected);
    });
  });

  describe('nullable', () => {
    type NullableName = {
      name: string | null;
    };

    const spec: ValidationSpec<NullableName> = {
      name: [Validators.nullable(Validators.minLength(2))],
    };

    const testCases = [
      { obj: { name: 'John' }, expected: VALID },
      { obj: { name: null }, expected: VALID },
      {
        obj: {},
        expected: expect.objectContaining({ reasonMap: { name: { reasons: expect.any(Array) } } }),
      },
    ];

    test.each(testCases)('should handle nullable values for $obj.name', (testCase) => {
      expect(validateObject(spec, testCase.obj)).toEqual(testCase.expected);
    });
  });

  describe('optional', () => {
    type OptionalName = {
      name?: string;
    };

    const spec: ValidationSpec<OptionalName> = {
      name: [Validators.optional(Validators.minLength(2))],
    };

    const testCases = [
      { obj: { name: 'John' }, expected: VALID },
      {
        obj: { name: null },
        expected: expect.objectContaining({ reasonMap: { name: { reasons: expect.any(Array) } } }),
      },
      { obj: {}, expected: VALID },
    ];

    test.each(testCases)('should handle optional values for $obj.name', (testCase) => {
      expect(validateObject(spec, testCase.obj)).toEqual(testCase.expected);
    });
  });

  describe('spec', () => {
    const testCases: Array<{
      description: string;
      spec: ValidationSpec<TestPerson>;
      value: unknown;
      expected: ValidatorResult;
    }> = [
      {
        description: 'should return valid for object that passes all validations',
        spec: {
          name: [Validators.minLength(1)],
          email: [Validators.isEmailAddress],
        },
        value: { name: 'John', email: 'john@example.com' },
        expected: VALID,
      },
      {
        description: 'should return invalid with reasons for object that fails validation',
        spec: {
          name: [Validators.minLength(5)],
          email: [Validators.isEmailAddress],
        },
        value: { name: 'Jo', email: 'invalid-email' },
        expected: {
          reasonMap: {
            name: { reasons: ['Must contain at least 5 characters'] },
            email: { reasons: ['Must be a valid email address'] },
          },
        },
      },
      {
        description: 'should handle empty object with required fields',
        spec: {
          name: [Validators.minLength(1)],
          email: [Validators.isEmailAddress],
        },
        value: {},
        expected: {
          reasonMap: {
            name: { reasons: ['Value is undefined'] },
            email: { reasons: ['Must be a valid email address'] },
          },
        },
      },
      {
        description: 'should validate object with optional fields when present',
        spec: {
          name: [Validators.minLength(1)],
          email: [Validators.optional(Validators.isEmailAddress)],
          phone: [Validators.optional(Validators.isPhoneNumber)],
        },
        value: { name: 'Alice', email: 'alice@example.com', phone: '123-456-7890' },
        expected: VALID,
      },
      {
        description: 'should validate object with optional fields when missing',
        spec: {
          name: [Validators.minLength(1)],
          email: [Validators.optional(Validators.isEmailAddress)],
          phone: [Validators.optional(Validators.isPhoneNumber)],
        },
        value: { name: 'Bob' },
        expected: VALID,
      },
      {
        description: 'should handle mixed validation results with optional fields',
        spec: {
          name: [Validators.minLength(3)],
          email: [Validators.optional(Validators.isEmailAddress)],
          phone: [Validators.optional(Validators.isPhoneNumber)],
        },
        value: { name: 'Al', email: 'invalid-email', phone: '123-456-7890' },
        expected: {
          reasonMap: {
            name: { reasons: ['Must contain at least 3 characters'] },
            email: { reasons: ['Must be a valid email address'] },
          },
        },
      },
      {
        description: 'should work with complex validation rules',
        spec: {
          name: [Validators.minLength(2), Validators.maxLength(50)],
          email: [Validators.isEmailAddress],
          code: [Validators.isInSet(['A', 'B', 'C'])],
        },
        value: { name: 'Charlie', email: 'charlie@test.com', code: 'B' },
        expected: VALID,
      },
      {
        description: 'should return invalid when multiple validators fail on same field',
        spec: {
          name: [Validators.minLength(10), Validators.matches(/^[A-Z]/)],
        },
        value: { name: 'short' },
        expected: {
          reasonMap: {
            name: {
              reasons: ['Must contain at least 10 characters', 'Must match the pattern /^[A-Z]/'],
            },
          },
        },
      },
      {
        description: 'should handle null input object',
        spec: {
          name: [Validators.minLength(1)],
        },
        value: null,
        expected: {
          reasons: ['Value must be an object'],
        },
      },
      {
        description: 'should handle undefined input object',
        spec: {
          name: [Validators.minLength(1)],
        },
        value: undefined,
        expected: {
          reasons: ['Value must be an object'],
        },
      },
      {
        description: 'should work with empty spec',
        spec: {},
        value: { name: 'anyValue' },
        expected: VALID,
      },
    ];

    test.each(testCases)('$description', (testCase) => {
      const validator = Validators.spec(testCase.spec);
      const result = validator(testCase.value);
      expect(result).toEqual(testCase.expected);
    });

    test('should return a function that can be called multiple times', () => {
      const spec: ValidationSpec<TestPerson> = { name: [Validators.minLength(1)] };
      const validator = Validators.spec(spec);

      expect(typeof validator).toBe('function');
      expect(validator({ name: 'Valid' })).toEqual(VALID);
      expect(validator({ name: '' })).toEqual({
        reasonMap: {
          name: { reasons: ['Must contain at least 1 characters'] },
        },
      });
    });

    test('should work with nested object specifications', () => {
      const profileSpec: ValidationSpec<{ age: number; city: string }> = {
        age: [Validators.matches(/^\d+$/, 'Age must be a number')],
        city: [Validators.minLength(1)],
      };

      const userSpec = {
        name: [Validators.minLength(1)],
        profile: profileSpec,
      } as ValidationSpec<TestPerson>;

      const validator = Validators.spec(userSpec);

      expect(
        validator({
          name: 'John',
          profile: { age: '25', city: 'NYC' },
        }),
      ).toEqual(VALID);

      expect(
        validator({
          name: '',
          profile: { age: 'invalid', city: '' },
        }),
      ).toEqual({
        reasonMap: {
          name: { reasons: ['Must contain at least 1 characters'] },
          profile: {
            reasonMap: {
              age: { reasons: ['Age must be a number'] },
              city: { reasons: ['Must contain at least 1 characters'] },
            },
          },
        },
      });
    });
  });

  describe('notSet', () => {
    const testCases = [
      {
        description: 'should return valid for undefined values',
        value: undefined,
        expected: VALID,
      },
      {
        description: 'should return valid for null values',
        value: null,
        expected: VALID,
      },
      {
        description: 'should return invalid for any other values',
        value: 'some value',
        expected: { reasons: ['Must not be set'] },
      },
      {
        description: 'should return invalid for empty string',
        value: '',
        expected: { reasons: ['Must not be set'] },
      },
      {
        description: 'should return invalid for number values',
        value: 0,
        expected: { reasons: ['Must not be set'] },
      },
    ];

    test.each(testCases)('$description', (testCase) => {
      expect(Validators.notSet(testCase.value)).toEqual(testCase.expected);
    });
  });

  describe('exactLength', () => {
    const testCases = [
      {
        description: 'should return valid for string with exact length',
        length: 5,
        value: 'hello',
        expected: VALID,
      },
      {
        description: 'should return invalid for string shorter than exact length',
        length: 10,
        value: 'hello',
        expected: { reasons: ['Must contain exactly 10 characters'] },
      },
      {
        description: 'should return invalid for string longer than exact length',
        length: 3,
        value: 'hello',
        expected: { reasons: ['Must contain exactly 3 characters'] },
      },
      {
        description: 'should return valid for array with exact length',
        length: 3,
        value: ['a', 'b', 'c'],
        expected: VALID,
      },
      {
        description: 'should use custom reason when provided',
        length: 5,
        reason: 'Custom length error',
        value: 'hi',
        expected: { reasons: ['Custom length error'] },
      },
    ];

    test.each(testCases)('$description', (testCase) => {
      const validator = Validators.exactLength(testCase.length, testCase.reason);
      expect(validator(testCase.value)).toEqual(testCase.expected);
    });
  });

  describe('length with custom reason', () => {
    test('should use custom reason when length validation fails', () => {
      const validator = Validators.length(5, 10, 'Custom length message');
      const result = validator('hi');
      expect(result).toEqual({ reasons: ['Custom length message'] });
    });
  });

  describe('arrayOf', () => {
    const testCases = [
      {
        description: 'should return valid for empty array',
        validators: [Validators.minLength(1)],
        value: [],
        expected: VALID,
      },
      {
        description: 'should return valid for array where all elements pass validation',
        validators: [Validators.minLength(2)],
        value: ['hello', 'world', 'test'],
        expected: VALID,
      },
      {
        description: 'should return invalid for non-array values',
        validators: [Validators.minLength(1)],
        value: 'not an array',
        expected: { reasons: ['Value is not an array'] },
      },
      {
        description: 'should return invalid for null values',
        validators: [Validators.minLength(1)],
        value: null,
        expected: { reasons: ['Value is not an array'] },
      },
      {
        description: 'should return invalid for undefined values',
        validators: [Validators.minLength(1)],
        value: undefined,
        expected: { reasons: ['Value is not an array'] },
      },
      {
        description: 'should return invalid for numeric values',
        validators: [Validators.minLength(1)],
        value: 123,
        expected: { reasons: ['Value is not an array'] },
      },
      {
        description: 'should return single error for array with one invalid element',
        validators: [Validators.minLength(5)],
        value: ['hello', 'hi', 'world'],
        expected: { reasons: ['Element at index 1: Must contain at least 5 characters'] },
      },
      {
        description: 'should return all errors for array with multiple invalid elements',
        validators: [Validators.minLength(5)],
        value: ['hello', 'hi', 'ok', 'world'],
        expected: {
          reasons: [
            'Element at index 1: Must contain at least 5 characters',
            'Element at index 2: Must contain at least 5 characters',
          ],
        },
      },
      {
        description: 'should work with multiple validators per element',
        validators: [Validators.minLength(3), Validators.maxLength(10)],
        value: ['hello', 'world', 'test'],
        expected: VALID,
      },
      {
        description: 'should return all validation failures from multiple validators',
        validators: [
          Validators.minLength(5),
          Validators.matches(/^[A-Z]/, 'Must start with uppercase'),
        ],
        value: ['Hi', 'ok'],
        expected: {
          reasons: [
            'Element at index 0: Must contain at least 5 characters',
            'Element at index 1: Must contain at least 5 characters',
            'Element at index 1: Must start with uppercase',
          ],
        },
      },
      {
        description: 'should work with email validation',
        validators: [Validators.isEmailAddress],
        value: ['test@example.com', 'user@domain.org'],
        expected: VALID,
      },
      {
        description: 'should return errors for invalid emails',
        validators: [Validators.isEmailAddress],
        value: ['test@example.com', 'invalid-email', 'another@valid.com', 'also-invalid'],
        expected: {
          reasons: [
            'Element at index 1: Must be a valid email address',
            'Element at index 3: Must be a valid email address',
          ],
        },
      },
      {
        description: 'should work with phone number validation',
        validators: [Validators.isPhoneNumber],
        value: ['123-456-7890', '987-654-3210'],
        expected: VALID,
      },
      {
        description: 'should return errors for invalid phone numbers',
        validators: [Validators.isPhoneNumber],
        value: ['123-456-7890', '123456', '987-654-3210'],
        expected: {
          reasons: ['Element at index 1: Must be a valid phone number'],
        },
      },
      {
        description: 'should work with isInSet validation',
        validators: [Validators.isInSet(['red', 'green', 'blue'])],
        value: ['red', 'blue', 'green'],
        expected: VALID,
      },
      {
        description: 'should return errors for values not in set',
        validators: [Validators.isInSet(['red', 'green', 'blue'])],
        value: ['red', 'yellow', 'blue', 'purple'],
        expected: {
          reasons: [
            'Element at index 1: Must be one of red, green, blue',
            'Element at index 3: Must be one of red, green, blue',
          ],
        },
      },
      {
        description: 'should work with mixed data types when validators support them',
        validators: [Validators.minLength(1)],
        value: ['hello', ['a', 'b'], 'world'],
        expected: VALID,
      },
      {
        description: 'should handle arrays with null/undefined elements',
        validators: [Validators.nullable(Validators.minLength(2))],
        value: ['hello', null, 'world'],
        expected: VALID,
      },
      {
        description: 'should return errors for invalid null/undefined elements',
        validators: [Validators.minLength(2)],
        value: ['hello', null, 'world', undefined],
        expected: {
          reasons: ['Element at index 1: Value is null', 'Element at index 3: Value is undefined'],
        },
      },
      {
        description: 'should work with optional validators',
        validators: [Validators.optional(Validators.minLength(5))],
        value: ['hello', undefined, 'world'],
        expected: VALID,
      },
      {
        description: 'should return errors when optional validation fails',
        validators: [Validators.optional(Validators.minLength(5))],
        value: ['hello', 'hi', undefined, 'world'],
        expected: {
          reasons: ['Element at index 1: Must contain at least 5 characters'],
        },
      },
      {
        description: 'should work with nested arrayOf validators',
        validators: [Validators.arrayOf(Validators.minLength(2))],
        value: [
          ['hello', 'world'],
          ['test', 'case'],
        ],
        expected: VALID,
      },
      {
        description: 'should return errors from nested arrayOf validators',
        validators: [Validators.arrayOf(Validators.minLength(5))],
        value: [
          ['hello', 'world'],
          ['hi', 'ok'],
        ],
        expected: {
          reasons: [
            'Element at index 1: Element at index 0: Must contain at least 5 characters',
            'Element at index 1: Element at index 1: Must contain at least 5 characters',
          ],
        },
      },
    ];

    test.each(testCases)('$description', (testCase) => {
      const validator = Validators.arrayOf(...testCase.validators);
      const result = validator(testCase.value);
      expect(result).toEqual(testCase.expected);
    });

    test('should preserve order of validation errors', () => {
      const validator = Validators.arrayOf(Validators.minLength(10));
      const result = validator(['short1', 'short2', 'short3']);

      expect(result).toEqual({
        reasons: [
          'Element at index 0: Must contain at least 10 characters',
          'Element at index 1: Must contain at least 10 characters',
          'Element at index 2: Must contain at least 10 characters',
        ],
      });
    });

    test('should handle large arrays efficiently', () => {
      const largeArray = Array(1000).fill('valid');
      const validator = Validators.arrayOf(Validators.minLength(1));
      const result = validator(largeArray);

      expect(result).toEqual(VALID);
    });

    test('should stop collecting errors appropriately for large arrays with many failures', () => {
      const largeInvalidArray = Array(1000).fill(''); // Empty strings fail minLength(1)
      const validator = Validators.arrayOf(Validators.minLength(1));
      const result = validator(largeInvalidArray);

      expect(result.valid).not.toBe(true);
      expect(result.reasons).toHaveLength(1000);
      expect(result.reasons![0]).toBe('Element at index 0: Must contain at least 1 characters');
      expect(result.reasons![999]).toBe('Element at index 999: Must contain at least 1 characters');
    });
  });

  describe('isValidDate', () => {
    const testCases = [
      {
        description: 'should return valid for properly formatted date',
        value: '2024-01-15',
        expected: VALID,
      },
      {
        description: 'should return valid for leap year date',
        value: '2024-02-29',
        expected: VALID,
      },
      {
        description: 'should return invalid for non-leap year Feb 29',
        value: '2023-02-29',
        expected: { reasons: ['Must be a valid date'] },
      },
      {
        description: 'should return invalid for incomplete date',
        value: '2024-01',
        expected: { reasons: ['Must be in YYYY-MM-DD format'] },
      },
      {
        description: 'should return invalid for wrong format',
        value: '01/15/2024',
        expected: { reasons: ['Must be in YYYY-MM-DD format'] },
      },
      {
        description: 'should return invalid for invalid month',
        value: '2024-13-01',
        expected: { reasons: ['Must be a valid date'] },
      },
      {
        description: 'should return invalid for invalid day',
        value: '2024-01-32',
        expected: { reasons: ['Must be a valid date'] },
      },
      {
        description: 'should return invalid for non-string value',
        value: 123,
        expected: { reasons: ['Must be a string'] },
      },
      {
        description: 'should return invalid for null',
        value: null,
        expected: { reasons: ['Must be a string'] },
      },
      {
        description: 'should return invalid for empty string',
        value: '',
        expected: { reasons: ['Must be in YYYY-MM-DD format'] },
      },
    ];
    test.each(testCases)('$description', (testCase) => {
      expect(Validators.isValidDate(testCase.value)).toEqual(testCase.expected);
    });
  });

  describe('dateMinMax', () => {
    const testCases = [
      {
        description: 'should return valid for date within range',
        min: '2024-01-01',
        max: '2024-12-31',
        value: '2024-06-15',
        expected: VALID,
      },
      {
        description: 'should return valid for date at minimum',
        min: '2024-01-01',
        max: '2024-12-31',
        value: '2024-01-01',
        expected: VALID,
      },
      {
        description: 'should return valid for date at maximum',
        min: '2024-01-01',
        max: '2024-12-31',
        value: '2024-12-31',
        expected: VALID,
      },
      {
        description: 'should return invalid for date before minimum',
        min: '2024-01-01',
        max: '2024-12-31',
        value: '2023-12-31',
        expected: { reasons: ['Date is before minimum allowed date'] },
      },
      {
        description: 'should return invalid for date after maximum',
        min: '2024-01-01',
        max: '2024-12-31',
        value: '2025-01-01',
        expected: { reasons: ['Date is after maximum allowed date'] },
      },
      {
        description: 'should return valid when no min specified',
        max: '2024-12-31',
        value: '2020-01-01',
        expected: VALID,
      },
      {
        description: 'should return valid when no max specified',
        min: '2024-01-01',
        value: '2030-01-01',
        expected: VALID,
      },
      {
        description: 'should return invalid for invalid date format',
        min: '2024-01-01',
        max: '2024-12-31',
        value: '01/15/2024',
        expected: { reasons: ['Must be in YYYY-MM-DD format'] },
      },
      {
        description: 'should return valid when no min or max specified',
        value: '2024-06-15',
        expected: VALID,
      },
      {
        description: 'should use custom reason when date is before minimum',
        min: '2024-01-01',
        max: '2024-12-31',
        reason: 'Date is not within allowed range. Enter a valid date.',
        value: '2023-12-31',
        expected: { reasons: ['Date is not within allowed range. Enter a valid date.'] },
      },
      {
        description: 'should use custom reason when date is after maximum',
        min: '2024-01-01',
        max: '2024-12-31',
        reason: 'Date is not within allowed range. Enter a valid date.',
        value: '2025-01-01',
        expected: { reasons: ['Date is not within allowed range. Enter a valid date.'] },
      },
    ];
    test.each(testCases)('$description', (testCase) => {
      const validator = Validators.dateMinMax(testCase.min, testCase.max, testCase.reason);
      expect(validator(testCase.value)).toEqual(testCase.expected);
    });
  });

  describe('dateBefore', () => {
    const testCases = [
      {
        description: 'should return valid for date before comparison date',
        compareDate: '2024-06-15',
        value: '2024-06-14',
        expected: VALID,
      },
      {
        description: 'should return invalid for date equal to comparison date',
        compareDate: '2024-06-15',
        value: '2024-06-15',
        expected: { reasons: ['Date must be before 2024-06-15'] },
      },
      {
        description: 'should return invalid for date after comparison date',
        compareDate: '2024-06-15',
        value: '2024-06-16',
        expected: { reasons: ['Date must be before 2024-06-15'] },
      },
      {
        description: 'should use custom reason when provided',
        compareDate: '2024-06-15',
        reason: 'Custom error message',
        value: '2024-06-16',
        expected: { reasons: ['Custom error message'] },
      },
      {
        description: 'should return invalid for invalid date format',
        compareDate: '2024-06-15',
        value: 'invalid',
        expected: { reasons: ['Must be in YYYY-MM-DD format'] },
      },
    ];
    test.each(testCases)('$description', (testCase) => {
      const validator = Validators.dateBefore(testCase.compareDate, testCase.reason);
      expect(validator(testCase.value)).toEqual(testCase.expected);
    });
  });

  describe('dateAfter', () => {
    const testCases = [
      {
        description: 'should return valid for date after comparison date',
        compareDate: '2024-06-15',
        value: '2024-06-16',
        expected: VALID,
      },
      {
        description: 'should return invalid for date equal to comparison date',
        compareDate: '2024-06-15',
        value: '2024-06-15',
        expected: { reasons: ['Date must be after 2024-06-15'] },
      },
      {
        description: 'should return invalid for date before comparison date',
        compareDate: '2024-06-15',
        value: '2024-06-14',
        expected: { reasons: ['Date must be after 2024-06-15'] },
      },
      {
        description: 'should use custom reason when provided',
        compareDate: '2024-06-15',
        reason: 'Custom error message',
        value: '2024-06-14',
        expected: { reasons: ['Custom error message'] },
      },
      {
        description: 'should return invalid for invalid date format',
        compareDate: '2024-06-15',
        value: 'invalid',
        expected: { reasons: ['Must be in YYYY-MM-DD format'] },
      },
    ];
    test.each(testCases)('$description', (testCase) => {
      const validator = Validators.dateAfter(testCase.compareDate, testCase.reason);
      expect(validator(testCase.value)).toEqual(testCase.expected);
    });
  });

  describe('futureDateWithinYears', () => {
    test('should return valid for date within threshold', () => {
      const now = new Date();
      const futureDate = new Date(now.getFullYear() + 2, now.getMonth(), now.getDate());
      const dateString = futureDate.toISOString().split('T')[0];

      const validator = Validators.futureDateWithinYears(5);
      expect(validator(dateString)).toEqual(VALID);
    });

    test('should return valid for date at exact threshold', () => {
      const now = new Date();
      const futureDate = new Date(now.getFullYear() + 5, now.getMonth(), now.getDate());
      const dateString = futureDate.toISOString().split('T')[0];

      const validator = Validators.futureDateWithinYears(5);
      expect(validator(dateString)).toEqual(VALID);
    });

    test('should return invalid for date beyond threshold', () => {
      const now = new Date();
      const futureDate = new Date(now.getFullYear() + 6, now.getMonth(), now.getDate());
      const dateString = futureDate.toISOString().split('T')[0];

      const validator = Validators.futureDateWithinYears(5);
      const result = validator(dateString);
      expect(result.valid).not.toBe(true);
      expect(result.reasons).toEqual(['Date must be within 5 years from today']);
    });

    test('should return valid for past date', () => {
      const validator = Validators.futureDateWithinYears(5);
      expect(validator('2020-01-01')).toEqual(VALID);
    });

    test('should return valid for current date', () => {
      const now = new Date();
      const dateString = now.toISOString().split('T')[0];

      const validator = Validators.futureDateWithinYears(5);
      expect(validator(dateString)).toEqual(VALID);
    });

    test('should use custom reason when provided', () => {
      const now = new Date();
      const futureDate = new Date(now.getFullYear() + 10, now.getMonth(), now.getDate());
      const dateString = futureDate.toISOString().split('T')[0];

      const validator = Validators.futureDateWithinYears(5, 'Date too far in future');
      const result = validator(dateString);
      expect(result.reasons).toEqual(['Date too far in future']);
    });

    test('should return invalid for invalid date format', () => {
      const validator = Validators.futureDateWithinYears(5);
      expect(validator('invalid')).toEqual({ reasons: ['Must be in YYYY-MM-DD format'] });
    });
  });
});
