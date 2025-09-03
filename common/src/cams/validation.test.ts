import V, { ValidationSpec, FieldValidationResult } from './validation';

type Person = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  status: 'active' | 'inactive';
};

describe('Simple Validation Library', () => {
  describe('Basic validators', () => {
    describe('required', () => {
      test.each([
        { value: 'hello', expected: { valid: true } },
        { value: 'hello world', expected: { valid: true } },
        { value: '0', expected: { valid: true } },
        { value: '', expected: { valid: false, error: 'This field is required' } },
        { value: null, expected: { valid: false, error: 'This field is required' } },
        { value: undefined, expected: { valid: false, error: 'This field is required' } },
      ])('should validate $value correctly', ({ value, expected }) => {
        const validator = V.required();
        expect(validator(value)).toEqual(expected);
      });

      test('should use custom error message', () => {
        const validator = V.required('Name is required');
        expect(validator('')).toEqual({
          valid: false,
          error: 'Name is required',
        });
      });
    });

    describe('isString', () => {
      test.each([
        { value: 'hello', expected: { valid: true } },
        { value: '', expected: { valid: true } },
        { value: 123, expected: { valid: false, error: 'Must be a string' } },
        { value: true, expected: { valid: false, error: 'Must be a string' } },
        { value: null, expected: { valid: false, error: 'Must be a string' } },
        { value: undefined, expected: { valid: false, error: 'Must be a string' } },
      ])('should validate $value correctly', ({ value, expected }) => {
        const validator = V.isString();
        expect(validator(value)).toEqual(expected);
      });
    });

    describe('minLength', () => {
      test.each([
        { value: 'hello', min: 3, expected: { valid: true } },
        {
          value: 'hi',
          min: 3,
          expected: { valid: false, error: 'Must have at least 3 characters' },
        },
        { value: '', min: 0, expected: { valid: true } },
        { value: ['a', 'b', 'c'], min: 2, expected: { valid: true } },
        { value: ['a'], min: 2, expected: { valid: false, error: 'Must have at least 2 items' } },
      ])('should validate $value with min $min correctly', ({ value, min, expected }) => {
        const validator = V.minLength(min);
        expect(validator(value)).toEqual(expected);
      });
    });

    describe('maxLength', () => {
      test.each([
        { value: 'hello', max: 10, expected: { valid: true } },
        {
          value: 'hello world!',
          max: 10,
          expected: { valid: false, error: 'Must have at most 10 characters' },
        },
        { value: ['a', 'b'], max: 3, expected: { valid: true } },
        {
          value: ['a', 'b', 'c', 'd'],
          max: 3,
          expected: { valid: false, error: 'Must have at most 3 items' },
        },
      ])('should validate $value with max $max correctly', ({ value, max, expected }) => {
        const validator = V.maxLength(max);
        expect(validator(value)).toEqual(expected);
      });
    });

    describe('exactLength', () => {
      test.each([
        { value: 'hello', length: 5, expected: { valid: true } },
        {
          value: 'hi',
          length: 5,
          expected: { valid: false, error: 'Must have exactly 5 characters' },
        },
        { value: ['a', 'b'], length: 2, expected: { valid: true } },
        { value: ['a'], length: 2, expected: { valid: false, error: 'Must have exactly 2 items' } },
      ])('should validate $value with length $length correctly', ({ value, length, expected }) => {
        const validator = V.exactLength(length);
        expect(validator(value)).toEqual(expected);
      });
    });

    describe('matches', () => {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

      test.each([
        { value: 'test@example.com', expected: { valid: true } },
        {
          value: 'invalid-email',
          expected: { valid: false, error: `Must match pattern ${emailRegex}` },
        },
        { value: 123, expected: { valid: false, error: 'Value must be a string' } },
      ])('should validate $value against email regex correctly', ({ value, expected }) => {
        const validator = V.matches(emailRegex);
        expect(validator(value)).toEqual(expected);
      });
    });

    describe('oneOf', () => {
      const options = ['red', 'green', 'blue'];

      test.each([
        { value: 'red', expected: { valid: true } },
        { value: 'yellow', expected: { valid: false, error: 'Must be one of: red, green, blue' } },
      ])('should validate $value in options correctly', ({ value, expected }) => {
        const validator = V.oneOf(options);
        expect(validator(value)).toEqual(expected);
      });
    });

    describe('optional', () => {
      test('should pass when value is undefined', () => {
        const validator = V.optional(V.required(), V.minLength(5));
        expect(validator(undefined)).toEqual({ valid: true });
      });

      test('should apply validators when value is defined', () => {
        const validator = V.optional(V.isString(), V.minLength(5));
        expect(validator('hi')).toEqual({
          valid: false,
          error: 'Must have at least 5 characters',
        });
        expect(validator('hello')).toEqual({ valid: true });
      });
    });

    describe('nullable', () => {
      test('should pass when value is null', () => {
        const validator = V.nullable(V.required(), V.minLength(5));
        expect(validator(null)).toEqual({ valid: true });
      });

      test('should apply validators when value is not null', () => {
        const validator = V.nullable(V.isString(), V.minLength(5));
        expect(validator('hi')).toEqual({
          valid: false,
          error: 'Must have at least 5 characters',
        });
        expect(validator('hello')).toEqual({ valid: true });
      });
    });
  });

  describe('Common patterns', () => {
    describe('email', () => {
      test.each([
        { value: 'test@example.com', expected: { valid: true } },
        { value: 'user+tag@domain.co.uk', expected: { valid: true } },
        {
          value: 'invalid-email',
          expected: { valid: false, error: 'Must be a valid email address' },
        },
        {
          value: '@domain.com',
          expected: { valid: false, error: 'Must be a valid email address' },
        },
        { value: 'user@', expected: { valid: false, error: 'Must be a valid email address' } },
      ])('should validate $value correctly', ({ value, expected }) => {
        const validator = V.email();
        expect(validator(value)).toEqual(expected);
      });
    });

    describe('phoneNumber', () => {
      test.each([
        { value: '1234567890', expected: { valid: true } },
        {
          value: '123456789',
          expected: { valid: false, error: 'Must be a valid 10-digit phone number' },
        },
        {
          value: '12345678901',
          expected: { valid: false, error: 'Must be a valid 10-digit phone number' },
        },
        {
          value: '123-456-7890',
          expected: { valid: false, error: 'Must be a valid 10-digit phone number' },
        },
      ])('should validate $value correctly', ({ value, expected }) => {
        const validator = V.phoneNumber();
        expect(validator(value)).toEqual(expected);
      });
    });

    describe('zipCode', () => {
      test.each([
        { value: '12345', expected: { valid: true } },
        { value: '12345-6789', expected: { valid: true } },
        { value: '1234', expected: { valid: false, error: 'Must be a valid ZIP code' } },
        { value: '123456', expected: { valid: false, error: 'Must be a valid ZIP code' } },
        { value: '12345-678', expected: { valid: false, error: 'Must be a valid ZIP code' } },
      ])('should validate $value correctly', ({ value, expected }) => {
        const validator = V.zipCode();
        expect(validator(value)).toEqual(expected);
      });
    });
  });

  describe('Core validation functions', () => {
    describe('validate', () => {
      test('should run a single validator', () => {
        const validator = V.required();
        expect(V.validate(validator, 'test')).toEqual({ valid: true });
        expect(V.validate(validator, '')).toEqual({
          valid: false,
          error: 'This field is required',
        });
      });
    });

    describe('validateValue', () => {
      test('should run multiple validators and return first error', () => {
        const validators = [V.required(), V.isString(), V.minLength(5)];

        expect(V.validateValue(validators, 'hello')).toEqual({ valid: true });
        expect(V.validateValue(validators, '')).toEqual({
          valid: false,
          error: 'This field is required',
        });
        expect(V.validateValue(validators, 'hi')).toEqual({
          valid: false,
          error: 'Must have at least 5 characters',
        });
      });
    });

    describe('validateField', () => {
      const spec: ValidationSpec<Person> = {
        firstName: [V.required(), V.isString(), V.minLength(2)],
        email: [V.required(), V.email()],
      };

      test('should validate a single field', () => {
        expect(V.validateField(spec, 'firstName', 'John')).toEqual({ valid: true });
        expect(V.validateField(spec, 'firstName', 'J')).toEqual({
          valid: false,
          error: 'Must have at least 2 characters',
        });
      });

      test('should return valid for fields not in spec', () => {
        expect(V.validateField(spec, 'lastName', 'anything')).toEqual({ valid: true });
      });
    });

    describe('validateObject', () => {
      const spec: ValidationSpec<Person> = {
        firstName: [V.required(), V.minLength(2)],
        lastName: [V.required(), V.minLength(2)],
        email: [V.required(), V.email()],
        phone: [V.required(), V.phoneNumber()],
        status: [V.required(), V.oneOf(['active', 'inactive'])],
      };

      it('should validate valid object', () => {
        const validPerson: Person = {
          firstName: 'John',
          lastName: 'Doe',
          email: 'john@example.com',
          phone: '1234567890',
          status: 'active',
        };

        const result = V.validateObject(spec, validPerson);
        expect(result).toEqual({});
        expect(V.hasErrors(result)).toBe(false);
      });

      test('should return errors for invalid object', () => {
        const invalidPerson: Partial<Person> = {
          firstName: 'J',
          lastName: '',
          email: 'invalid-email',
          phone: '123',
          status: 'unknown' as 'active' | 'inactive', // Intentionally invalid
        };

        const result = V.validateObject(spec, invalidPerson);
        expect(V.hasErrors(result)).toBe(true);

        expect(result.firstName).toBe('Must have at least 2 characters');
        expect(result.lastName).toBe('This field is required');
        expect(result.email).toBe('Must be a valid email address');
        expect(result.phone).toBe('Must be a valid 10-digit phone number');
        expect(result.status).toBe('Must be one of: active, inactive');
      });

      test('should handle partial objects', () => {
        const partialPerson = {
          firstName: 'John',
          email: 'john@example.com',
        };

        const result = V.validateObject(spec, partialPerson);
        expect(result.lastName).toBe('This field is required');
        expect(result.phone).toBe('This field is required');
        expect(result.status).toBe('This field is required');
        expect(result.firstName).toBeUndefined();
        expect(result.email).toBeUndefined();
      });
    });

    describe('hasErrors', () => {
      test('should return true when there are errors', () => {
        const results: FieldValidationResult = {
          field1: 'Error message',
          field2: undefined,
        };
        expect(V.hasErrors(results)).toBe(true);
      });

      test('should return false when there are no errors', () => {
        const results: FieldValidationResult = {
          field1: undefined,
          field2: undefined,
        };
        expect(V.hasErrors(results)).toBe(false);
      });
    });

    describe('getErrors', () => {
      test('should return array of error messages', () => {
        const results: FieldValidationResult = {
          field1: 'Error 1',
          field2: undefined,
          field3: 'Error 3',
        };
        expect(V.getErrors(results)).toEqual(['Error 1', 'Error 3']);
      });

      test('should return empty array when no errors', () => {
        const results: FieldValidationResult = {
          field1: undefined,
          field2: undefined,
        };
        expect(V.getErrors(results)).toEqual([]);
      });
    });
  });

  describe('Complex validation scenarios', () => {
    test('should handle form validation workflow', () => {
      const formSpec: ValidationSpec<Person> = {
        firstName: [
          V.required('First name is required'),
          V.minLength(2, 'First name must be at least 2 characters'),
        ],
        lastName: [
          V.required('Last name is required'),
          V.minLength(2, 'Last name must be at least 2 characters'),
        ],
        email: [V.required('Email is required'), V.email('Please enter a valid email address')],
        phone: [V.optional(V.phoneNumber('Please enter a valid 10-digit phone number'))],
        status: [
          V.required('Status is required'),
          V.oneOf(['active', 'inactive'], 'Status must be active or inactive'),
        ],
      };

      // Simulate user typing in form
      const formData: Partial<Person> = {
        firstName: '',
        lastName: 'D',
        email: 'john@',
        phone: undefined,
        status: 'active',
      };

      const errors = V.validateObject(formSpec, formData);

      expect(errors.firstName).toBe('First name is required');
      expect(errors.lastName).toBe('Last name must be at least 2 characters');
      expect(errors.email).toBe('Please enter a valid email address');
      expect(errors.phone).toBeUndefined(); // Optional field
      expect(errors.status).toBeUndefined(); // Valid value

      // Test field-by-field validation (for real-time feedback)
      expect(V.validateField(formSpec, 'firstName', 'John')).toEqual({ valid: true });
      expect(V.validateField(formSpec, 'email', 'john@example.com')).toEqual({ valid: true });
    });
  });

  describe('Edge cases for better coverage', () => {
    test('should handle specs with falsy validators', () => {
      // Create a spec and then delete a property to make it undefined
      const spec: ValidationSpec<{ name: string; age: string }> = {
        name: [V.required()],
        age: [V.required()],
      };

      // Delete the age property to create an undefined validator scenario
      delete (spec as Record<string, unknown>).age;

      const obj = { name: 'John', age: '25' };
      const errors = V.validateObject(spec, obj);

      expect(errors.name).toBeUndefined();
      expect(errors.age).toBeUndefined();
    });

    describe('minLength edge cases', () => {
      test('should handle null/undefined with custom message', () => {
        const validator = V.minLength(3, 'Custom minimum length error');
        expect(validator(null)).toEqual({
          valid: false,
          error: 'Custom minimum length error',
        });
        expect(validator(undefined)).toEqual({
          valid: false,
          error: 'Custom minimum length error',
        });
      });

      test('should handle values without length property', () => {
        const validator = V.minLength(3);
        expect(validator(123)).toEqual({
          valid: false,
          error: 'Value must have a length property',
        });
        expect(validator({})).toEqual({
          valid: false,
          error: 'Value must have a length property',
        });
      });
    });

    describe('maxLength edge cases', () => {
      test('should handle values without length property', () => {
        const validator = V.maxLength(10);
        expect(validator(123)).toEqual({
          valid: false,
          error: 'Value must have a length property',
        });
        expect(validator({})).toEqual({
          valid: false,
          error: 'Value must have a length property',
        });
      });
    });

    describe('exactLength edge cases', () => {
      test('should handle values without length property', () => {
        const validator = V.exactLength(5);
        expect(validator(123)).toEqual({
          valid: false,
          error: 'Value must have a length property',
        });
        expect(validator({})).toEqual({
          valid: false,
          error: 'Value must have a length property',
        });
      });
    });
  });
});
