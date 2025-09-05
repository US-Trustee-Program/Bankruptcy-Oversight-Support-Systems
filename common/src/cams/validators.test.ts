import {
  ValidationSpec,
  validateObject,
  validateKey,
  validate,
  validateEach,
  VALID,
} from './validation';
import Validators from './validators';

type Person = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  code: string;
};

describe('validators', () => {
  describe('minLength', () => {
    const testCases = [
      {
        description: 'should return valid for string meeting minimum length',
        minLength: 5,
        value: 'hello',
        expected: VALID,
      },
      {
        description: 'should return valid for string exactly at minimum length',
        minLength: 5,
        value: 'hello',
        expected: VALID,
      },
      {
        description: 'should return invalid for string shorter than minimum length',
        minLength: 10,
        value: 'hello',
        expected: { reasons: ['Must contain at least 10 characters'] },
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
        description: 'should return valid for string under maximum length',
        maxLength: 10,
        value: 'hello',
        expected: VALID,
      },
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
        description: 'should return invalid for string shorter than minimum',
        min: 10,
        max: 15,
        value: 'hello',
        expected: { reasons: ['Must contain between 10 and 15 characters'] },
      },
      {
        description: 'should return invalid for string longer than maximum',
        min: 1,
        max: 3,
        value: 'hello',
        expected: { reasons: ['Must contain between 1 and 3 characters'] },
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
        min: 5,
        max: 10,
        value: ['a', 'b'],
        expected: { reasons: ['Must contain between 5 and 10 selections'] },
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

  describe('validate', () => {
    const testCases = [
      {
        description: 'should work with factory validator functions',
        validator: Validators.minLength(5),
        value: 'hello world',
        expected: VALID,
      },
      {
        description: 'should return failure for factory validator functions',
        validator: Validators.minLength(10),
        value: 'short',
        expected: { reasons: ['Must contain at least 10 characters'] },
      },
    ];
    test.each(testCases)('$description', (testCase) => {
      expect(validate(testCase.validator, testCase.value)).toEqual(testCase.expected);
    });
  });

  describe('validateEach', () => {
    const testCases = [
      {
        description: 'should return valid when all validators pass',
        validators: [Validators.minLength(3)],
        value: 'hello',
        expected: VALID,
      },
      {
        description: 'should return invalid with single reason when one validator fails',
        validators: [Validators.minLength(10)],
        value: 'hello',
        expected: { reasons: ['Must contain at least 10 characters'] },
      },
      {
        description: 'should return invalid with multiple reasons when multiple validators fail',
        validators: [Validators.minLength(10), Validators.maxLength(3)],
        value: 'hello',
        expected: {
          reasons: ['Must contain at least 10 characters', 'Must contain at most 3 characters'],
        },
      },
      {
        description: 'should work with mix of direct and factory validators',
        validators: [Validators.length(3, 10), Validators.matches(/^[a-z]+$/)],
        value: 'hello',
        expected: VALID,
      },
      {
        description: 'should accumulate all failure reasons',
        validators: [Validators.minLength(10), Validators.matches(/^\d+$/)],
        value: 'hello',
        expected: {
          reasons: ['Must contain at least 10 characters', 'Must match the pattern /^\\d+$/'],
        },
      },
      {
        description: 'should handle empty validator array',
        validators: [],
        value: 'anything',
        expected: VALID,
      },
      {
        description: 'should handle single validator',
        validators: [Validators.isEmailAddress],
        value: 'test@example.com',
        expected: VALID,
      },
      {
        description: 'should handle single failing validator',
        validators: [Validators.isEmailAddress],
        value: 'invalid-email',
        expected: { reasons: ['Must be a valid email address'] },
      },
    ];
    test.each(testCases)('$description', (testCase) => {
      expect(validateEach(testCase.validators, testCase.value)).toEqual(testCase.expected);
    });
  });

  describe('validateKey', () => {
    test('should return valid when key validation passes', () => {
      const spec = { name: [Validators.minLength(2)] };
      const obj = { name: 'John' };
      expect(validateKey(spec, 'name', obj)).toEqual(VALID);
    });

    test('should return invalid with reasons when key validation fails', () => {
      const spec = { name: [Validators.minLength(5)] };
      const obj = { name: 'Jo' };
      expect(validateKey(spec, 'name', obj)).toEqual({
        reasons: ['Must contain at least 5 characters'],
      });
    });

    test('should handle multiple validators with multiple failures', () => {
      const spec = { name: [Validators.minLength(10), Validators.matches(/^\d+$/)] };
      const obj = { name: 'John' };
      expect(validateKey(spec, 'name', obj)).toEqual({
        reasons: ['Must contain at least 10 characters', 'Must match the pattern /^\\d+$/'],
      });
    });

    test('should validate email key correctly', () => {
      const spec = { email: [Validators.isEmailAddress] };
      const obj = { email: 'test@example.com' };
      expect(validateKey(spec, 'email', obj)).toEqual(VALID);
    });

    test('should return invalid for bad email format', () => {
      const spec = { email: [Validators.isEmailAddress] };
      const obj = { email: 'invalid-email' };
      expect(validateKey(spec, 'email', obj)).toEqual({
        reasons: ['Must be a valid email address'],
      });
    });

    test('should handle single validator successfully', () => {
      const spec = { name: [Validators.minLength(1)] };
      const obj = { name: 'Alice' };
      expect(validateKey(spec, 'name', obj)).toEqual(VALID);
    });
  });

  describe('validateObject', () => {
    const validCodes = ['a', 'b'];
    const spec: ValidationSpec<Person> = {
      firstName: [Validators.minLength(1)],
      lastName: [Validators.length(1, 100)],
      phone: [Validators.isPhoneNumber],
      email: [Validators.isEmailAddress],
      code: [Validators.isInSet(validCodes)],
    };

    const testCases = [
      {
        description: 'should validate a valid object',
        obj: {
          firstName: 'John',
          lastName: 'Doe',
          email: 'john@doe.com',
          phone: '123-456-7890',
          code: 'a',
        },
        expected: VALID,
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
          reasonMap: {
            firstName: { reasons: ['Must contain at least 1 characters'] },
            lastName: { reasons: ['Must contain between 1 and 100 characters'] },
            email: { reasons: ['Must be a valid email address'] },
            phone: { reasons: ['Must be a valid phone number'] },
            code: { reasons: ['Must be one of a, b'] },
          },
        },
      },
    ];
    test.each(testCases)('$description', (testCase) => {
      expect(validateObject(spec, testCase.obj)).toEqual(
        expect.objectContaining(testCase.expected),
      );
    });
  });

  describe('spec', () => {
    const testCases = [
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
        value: { anyField: 'anyValue' },
        expected: VALID,
      },
    ];

    test.each(testCases)('$description', (testCase) => {
      const validator = Validators.spec(testCase.spec);
      const result = validator(testCase.value);
      expect(result).toEqual(testCase.expected);
    });

    test('should return a function that can be called multiple times', () => {
      const spec = { name: [Validators.minLength(1)] };
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
      const profileSpec = {
        age: [Validators.matches(/^\d+$/, 'Age must be a number')],
        city: [Validators.minLength(1)],
      };

      const userSpec = {
        name: [Validators.minLength(1)],
        profile: profileSpec,
      };

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

  describe('nested object validation', () => {
    type Address = {
      street: string;
      city: string;
      zipCode: string;
      country?: string;
    };

    type PersonWithAddress = {
      name: string;
      address: Address;
      email?: string;
    };

    const addressSpec: ValidationSpec<Address> = {
      street: [Validators.minLength(1)],
      city: [Validators.minLength(1)],
      zipCode: [Validators.matches(/^\d{5}$/, 'ZIP code must be 5 digits')],
      country: [Validators.optional(Validators.minLength(2))],
    };

    const personWithAddressSpec: ValidationSpec<PersonWithAddress> = {
      name: [Validators.minLength(1)],
      address: addressSpec, // This is a nested ValidationSpec
      email: [Validators.optional(Validators.isEmailAddress)],
    };

    const testCases = [
      {
        description: 'should validate valid nested object',
        obj: {
          name: 'John Doe',
          address: {
            street: '123 Main St',
            city: 'Anytown',
            zipCode: '12345',
          },
          email: 'john@example.com',
        },
        expected: VALID,
      },
      {
        description: 'should validate nested object with optional field',
        obj: {
          name: 'Jane Smith',
          address: {
            street: '456 Oak Ave',
            city: 'Springfield',
            zipCode: '67890',
            country: 'US',
          },
        },
        expected: VALID,
      },
      {
        description: 'should return errors for invalid nested object fields',
        obj: {
          name: '', // Invalid: empty name
          address: {
            street: '', // Invalid: empty street
            city: 'Valid City',
            zipCode: '1234', // Invalid: wrong ZIP format
          },
          email: 'invalid-email', // Invalid: not a valid email
        },
        expected: {
          reasonMap: expect.objectContaining({
            name: { reasons: ['Must contain at least 1 characters'] },
            address: {
              reasonMap: {
                street: { reasons: ['Must contain at least 1 characters'] },
                zipCode: { reasons: ['ZIP code must be 5 digits'] },
              },
            },
            email: { reasons: ['Must be a valid email address'] },
          }),
        },
      },
      {
        description: 'should handle nested object with single validation error',
        obj: {
          name: 'Valid Name',
          address: {
            street: 'Valid Street',
            city: 'Valid City',
            zipCode: 'INVALID', // Only this field is invalid
          },
        },
        expected: {
          reasonMap: expect.objectContaining({
            address: {
              reasonMap: {
                zipCode: { reasons: ['ZIP code must be 5 digits'] },
              },
            },
          }),
        },
      },
      {
        description: 'should handle deeply nested validation with optional country',
        obj: {
          name: 'Test User',
          address: {
            street: '789 Pine St',
            city: 'TestCity',
            zipCode: '54321',
            country: 'A', // Invalid: too short
          },
        },
        expected: {
          reasonMap: expect.objectContaining({
            address: {
              reasonMap: {
                country: { reasons: ['Must contain at least 2 characters'] },
              },
            },
          }),
        },
      },
    ];

    test.each(testCases)('$description', (testCase) => {
      const result = validateObject(personWithAddressSpec, testCase.obj);
      expect(result).toEqual(testCase.expected);
    });
  });
});
