import {
  validate,
  validateEach,
  validateKey,
  validateObject,
  VALID,
  ValidationSpec,
  ValidatorFunction,
  ValidatorResult,
} from './validation';
import { EMAIL_REGEX, PHONE_REGEX } from './regex';

function hasLength(value: unknown): value is { length: number } {
  return (
    typeof value === 'string' || (typeof value === 'object' && value !== null && 'length' in value)
  );
}

// validatorA: Handles length validations (minLength, maxLength, length)
function validatorA(
  type: 'min' | 'max' | 'exact',
  param1: number,
  param2?: number,
  reason?: string,
): ValidatorFunction {
  return (value: unknown): ValidatorResult => {
    if (!hasLength(value)) {
      if (value === null) {
        return { reasons: [`Value is null`] };
      } else if (value === undefined) {
        return { reasons: [`Value is undefined`] };
      } else {
        return { reasons: ['Value does not have a length'] };
      }
    }

    let min: number, max: number;

    if (type === 'min') {
      min = param1;
      max = Infinity;
    } else if (type === 'max') {
      min = 0;
      max = param1;
    } else if (type === 'exact') {
      min = param1;
      max = param2 ?? param1;
    }

    if (value.length >= min && value.length <= max) {
      return VALID;
    }

    if (reason) {
      return { reasons: [reason] };
    }

    let rangeText: string;
    if (type === 'min') {
      rangeText = `at least ${min}`;
    } else if (type === 'max') {
      rangeText = `at most ${max}`;
    } else if (min === max) {
      rangeText = `exactly ${min}`;
    } else {
      rangeText = `between ${min} and ${max}`;
    }

    const unitText = typeof value === 'string' ? 'characters' : 'selections';
    return { reasons: [`Must contain ${rangeText} ${unitText}`] };
  };
}

// validatorB: Handles pattern matching (matches, isEmailAddress, isPhoneNumber)
function validatorB(
  type: 'regex' | 'email' | 'phone',
  pattern?: RegExp,
  reason?: string,
): ValidatorFunction {
  return (value: unknown): ValidatorResult => {
    let regex: RegExp;
    let defaultReason: string;

    if (type === 'email') {
      regex = EMAIL_REGEX;
      defaultReason = 'Must be a valid email address';
    } else if (type === 'phone') {
      regex = PHONE_REGEX;
      defaultReason = 'Must be a valid phone number';
    } else if (type === 'regex' && pattern) {
      regex = pattern;
      defaultReason = `Must match the pattern ${regex}`;
    } else {
      return { reasons: ['Invalid validator configuration'] };
    }

    return typeof value === 'string' && regex.test(value)
      ? VALID
      : { reasons: [reason ?? defaultReason] };
  };
}

// validatorC: Handles set validation and optional wrapper (isInSet, optional)
function validatorC<T>(
  type: 'inSet' | 'optional',
  param1?: T[] | ValidatorFunction[],
  reason?: string,
): ValidatorFunction {
  return (value: unknown): ValidatorResult => {
    if (type === 'inSet') {
      const set = param1 as T[];
      return set.includes(value as T)
        ? VALID
        : { reasons: [reason ?? `Must be one of ${set.join(', ')}`] };
    } else if (type === 'optional') {
      const validators = param1 as ValidatorFunction[];
      return value === undefined ? VALID : validateEach(validators, value);
    } else {
      return { reasons: ['Invalid validator configuration'] };
    }
  };
}

// Helper functions to maintain compatibility with existing test code
const minLength = (min: number, reason?: string) => validatorA('min', min, undefined, reason);
const maxLength = (max: number, reason?: string) => validatorA('max', max, undefined, reason);
const length = (min: number, max: number, reason?: string) => validatorA('exact', min, max, reason);
const matches = (regex: RegExp, reason?: string) => validatorB('regex', regex, reason);
const isEmailAddress = (value: unknown) => validatorB('email')(value);
const isPhoneNumber = (value: unknown) => validatorB('phone')(value);
const isInSet = <T>(set: T[], reason?: string) => validatorC<T>('inSet', set, reason);
const optional = (...validators: ValidatorFunction[]) => validatorC('optional', validators);

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
        validator: minLength(5),
        value: 'hello world',
        expected: VALID,
      },
      {
        description: 'should return failure for factory validator functions',
        validator: minLength(10),
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
        validators: [minLength(3)],
        value: 'hello',
        expected: VALID,
      },
      {
        description: 'should return invalid with single reason when one validator fails',
        validators: [minLength(10)],
        value: 'hello',
        expected: { reasons: ['Must contain at least 10 characters'] },
      },
      {
        description: 'should return invalid with multiple reasons when multiple validators fail',
        validators: [minLength(10), maxLength(3)],
        value: 'hello',
        expected: {
          reasons: ['Must contain at least 10 characters', 'Must contain at most 3 characters'],
        },
      },
      {
        description: 'should work with mix of direct and factory validators',
        validators: [length(3, 10), matches(/^[a-z]+$/)],
        value: 'hello',
        expected: VALID,
      },
      {
        description: 'should accumulate all failure reasons',
        validators: [minLength(10), matches(/^\d+$/)],
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
        validators: [isEmailAddress],
        value: 'test@example.com',
        expected: VALID,
      },
      {
        description: 'should handle single failing validator',
        validators: [isEmailAddress],
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
      const spec = { name: [minLength(2)] };
      const obj = { name: 'John' };
      expect(validateKey(spec, 'name', obj)).toEqual(VALID);
    });

    test('should return invalid with reasons when key validation fails', () => {
      const spec = { name: [minLength(5)] };
      const obj = { name: 'Jo' };
      expect(validateKey(spec, 'name', obj)).toEqual({
        reasons: ['Must contain at least 5 characters'],
      });
    });

    test('should handle multiple validators with multiple failures', () => {
      const spec = { name: [minLength(10), matches(/^\d+$/)] };
      const obj = { name: 'John' };
      expect(validateKey(spec, 'name', obj)).toEqual({
        reasons: ['Must contain at least 10 characters', 'Must match the pattern /^\\d+$/'],
      });
    });

    test('should validate email key correctly', () => {
      const spec = { email: [isEmailAddress] };
      const obj = { email: 'test@example.com' };
      expect(validateKey(spec, 'email', obj)).toEqual(VALID);
    });

    test('should return invalid for bad email format', () => {
      const spec = { email: [isEmailAddress] };
      const obj = { email: 'invalid-email' };
      expect(validateKey(spec, 'email', obj)).toEqual({
        reasons: ['Must be a valid email address'],
      });
    });

    test('should handle single validator successfully', () => {
      const spec = { name: [minLength(1)] };
      const obj = { name: 'Alice' };
      expect(validateKey(spec, 'name', obj)).toEqual(VALID);
    });
  });

  describe('validateObject', () => {
    const validCodes = ['a', 'b'];
    const spec: ValidationSpec<TestPerson> = {
      firstName: [minLength(1)],
      lastName: [length(1, 100)],
      phone: [isPhoneNumber],
      email: [isEmailAddress],
      code: [isInSet(validCodes)],
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
      street: [minLength(1)],
      city: [minLength(1)],
      zipCode: [matches(/^\d{5}$/, 'ZIP code must be 5 digits')],
      country: [optional(minLength(2))],
    };

    const personWithAddressSpec: ValidationSpec<PersonWithAddress> = {
      name: [minLength(1)],
      address: addressSpec, // This is a nested ValidationSpec
      email: [optional(isEmailAddress)],
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
