import {
  ValidationSpec,
  validate,
  validateEach,
  validateKey,
  validateObject,
  VALID,
} from './validation';
import V from './validators';

type TestPerson = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  code: string;
};

describe('validation', () => {
  describe('validate', () => {
    const testCases = [
      {
        description: 'should work with factory validator functions',
        validator: V.minLength(5),
        value: 'hello world',
        expected: VALID,
      },
      {
        description: 'should return failure for factory validator functions',
        validator: V.minLength(10),
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
        validators: [V.minLength(3)],
        value: 'hello',
        expected: VALID,
      },
      {
        description: 'should return invalid with single reason when one validator fails',
        validators: [V.minLength(10)],
        value: 'hello',
        expected: { reasons: ['Must contain at least 10 characters'] },
      },
      {
        description: 'should return invalid with multiple reasons when multiple validators fail',
        validators: [V.minLength(10), V.maxLength(3)],
        value: 'hello',
        expected: {
          reasons: ['Must contain at least 10 characters', 'Must contain at most 3 characters'],
        },
      },
      {
        description: 'should work with mix of direct and factory validators',
        validators: [V.length(3, 10), V.matches(/^[a-z]+$/)],
        value: 'hello',
        expected: VALID,
      },
      {
        description: 'should accumulate all failure reasons',
        validators: [V.minLength(10), V.matches(/^\d+$/)],
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
        validators: [V.isEmailAddress],
        value: 'test@example.com',
        expected: VALID,
      },
      {
        description: 'should handle single failing validator',
        validators: [V.isEmailAddress],
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
      const spec = { name: [V.minLength(2)] };
      const obj = { name: 'John' };
      expect(validateKey(spec, 'name', obj)).toEqual(VALID);
    });

    test('should return invalid with reasons when key validation fails', () => {
      const spec = { name: [V.minLength(5)] };
      const obj = { name: 'Jo' };
      expect(validateKey(spec, 'name', obj)).toEqual({
        reasons: ['Must contain at least 5 characters'],
      });
    });

    test('should handle multiple validators with multiple failures', () => {
      const spec = { name: [V.minLength(10), V.matches(/^\d+$/)] };
      const obj = { name: 'John' };
      expect(validateKey(spec, 'name', obj)).toEqual({
        reasons: ['Must contain at least 10 characters', 'Must match the pattern /^\\d+$/'],
      });
    });

    test('should validate email key correctly', () => {
      const spec = { email: [V.isEmailAddress] };
      const obj = { email: 'test@example.com' };
      expect(validateKey(spec, 'email', obj)).toEqual(VALID);
    });

    test('should return invalid for bad email format', () => {
      const spec = { email: [V.isEmailAddress] };
      const obj = { email: 'invalid-email' };
      expect(validateKey(spec, 'email', obj)).toEqual({
        reasons: ['Must be a valid email address'],
      });
    });

    test('should handle single validator successfully', () => {
      const spec = { name: [V.minLength(1)] };
      const obj = { name: 'Alice' };
      expect(validateKey(spec, 'name', obj)).toEqual(VALID);
    });
  });

  describe('validateObject', () => {
    const validCodes = ['a', 'b'];
    const spec: ValidationSpec<TestPerson> = {
      firstName: [V.minLength(1)],
      lastName: [V.length(1, 100)],
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
      street: [V.minLength(1)],
      city: [V.minLength(1)],
      zipCode: [V.matches(/^\d{5}$/, 'ZIP code must be 5 digits')],
      country: [V.optional(V.minLength(2))],
    };

    const personWithAddressSpec: ValidationSpec<PersonWithAddress> = {
      name: [V.minLength(1)],
      address: addressSpec, // This is a nested ValidationSpec
      email: [V.optional(V.isEmailAddress)],
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
    ];

    test.each(testCases)('$description', (testCase) => {
      const result = validateObject(personWithAddressSpec, testCase.obj);
      expect(result).toEqual(testCase.expected);
    });
  });
});
