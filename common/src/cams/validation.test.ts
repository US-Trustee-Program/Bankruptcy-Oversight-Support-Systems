import { describe, test, expect } from 'vitest';
import {
  validate,
  validateEach,
  validateKey,
  validateObject,
  flattenReasonMap,
  flatten,
  VALID,
  ValidationSpec,
  ValidatorFunction,
  ValidatorResult,
  mergeValidatorResults,
} from './validation';
import Validators from './validators';

// Single test validator function that only accepts "OK"
const validator: ValidatorFunction = (value: unknown): ValidatorResult => {
  return typeof value === 'string' && value === 'OK' ? VALID : { reasons: ['Failed validation.'] };
};

const validator2: ValidatorFunction = (value: unknown): ValidatorResult => {
  return typeof value === 'string' && value === 'Affirmative'
    ? VALID
    : { reasons: ['Failed validation too.'] };
};

type TestPerson = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  code: string;
};

describe('validation', () => {
  describe('mergeValidatorResults', () => {
    test('should merge two valid results', () => {
      expect(mergeValidatorResults(VALID, VALID)).toEqual(VALID);
    });

    test('should return the invalid result if either side is valid', () => {
      const bad = { reasons: ['Bad'] };
      expect(mergeValidatorResults(bad, VALID)).toEqual(bad);
      expect(mergeValidatorResults(VALID, bad)).toEqual(bad);
    });

    test('should merge two invalid results', () => {
      const bad1 = {
        reasons: ['Bad 1'],
        reasonMap: {
          foo: { reasons: ['Max length exceeded'] },
          bar: { reasons: ['Max length exceeded'] },
          baz: { reasonMap: { one: { reasons: ['Max length exceeded'] } } },
        },
      };
      const bad2 = {
        reasons: ['Bad 2'],
        reasonMap: { bar: { reasons: ['Invalid format'] } },
        baz: {
          reasonMap: { one: { reasons: ['Invalid format'] }, two: { reasons: ['Invalid format'] } },
        },
      };
      expect(mergeValidatorResults(bad1, bad2)).toEqual({
        reasons: expect.arrayContaining(['Bad 1', 'Bad 2']),
        reasonMap: {
          foo: { reasons: ['Max length exceeded'] },
          bar: { reasons: expect.arrayContaining(['Max length exceeded', 'Invalid format']) },
          baz: {
            reasonMap: {
              one: { reasons: expect.arrayContaining(['Max length exceeded', 'Invalid format']) },
              two: { reasons: ['Invalid format'] },
            },
          },
        },
      });
    });
  });

  describe('$ validation', () => {
    test('should validate using $ key in ValidationSpec', () => {
      const compoundFunction: ValidatorFunction = (value: unknown): ValidatorResult => {
        const testPerson = value as TestPerson;
        if (!testPerson.email && !testPerson.phone) {
          return { reasons: ['At least a phone or email address is required'] };
        } else {
          return VALID;
        }
      };

      const testSpec: ValidationSpec<TestPerson> = {
        $: [compoundFunction],
        firstName: [Validators.minLength(10)],
      };

      const testObj: TestPerson = {
        firstName: 'Bob',
      } as unknown as TestPerson;

      expect(validateObject(testSpec, testObj)).toEqual({
        reasonMap: {
          $: { reasons: ['At least a phone or email address is required'] },
          firstName: { reasons: ['Must contain at least 10 characters'] },
        },
      });
    });

    test('should put reasons on specific field', () => {
      const compoundFunction: ValidatorFunction = (value: unknown): ValidatorResult => {
        const testPerson = value as TestPerson;
        if (!testPerson.email && !testPerson.phone) {
          return {
            reasonMap: {
              email: {
                reasons: ['At least a phone or email address is required'],
              },
            },
          };
        } else {
          return VALID;
        }
      };

      const testSpec: ValidationSpec<TestPerson> = {
        $: [compoundFunction],
        firstName: [Validators.minLength(10)],
      };

      const testObj: TestPerson = {
        firstName: 'Bob',
      } as unknown as TestPerson;

      expect(validateObject(testSpec, testObj)).toEqual({
        reasonMap: {
          $: {
            reasonMap: {
              email: {
                reasons: ['At least a phone or email address is required'],
              },
            },
          },
          email: { reasons: ['At least a phone or email address is required'] },
          firstName: { reasons: ['Must contain at least 10 characters'] },
        },
      });
    });
  });

  describe('validate', () => {
    const testCases = [
      {
        description: 'should return valid for "OK" value',
        validator: validator,
        value: 'OK',
        expected: VALID,
      },
      {
        description: 'should return failure for non-"OK" string',
        validator: validator,
        value: 'hello',
        expected: { reasons: ['Failed validation.'] },
      },
      {
        description: 'should return failure for non-string value',
        validator: validator,
        value: 123,
        expected: { reasons: ['Failed validation.'] },
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
        validators: [validator],
        value: 'OK',
        expected: VALID,
      },
      {
        description: 'should return invalid with single reason when validator fails',
        validators: [validator],
        value: 'hello',
        expected: { reasons: ['Failed validation.'] },
      },
      {
        description: 'should return invalid with multiple reasons when multiple validators fail',
        validators: [validator, validator2],
        value: 'hello',
        expected: {
          reasons: ['Failed validation.', 'Failed validation too.'],
        },
      },
      {
        description: 'should handle empty validator array',
        validators: [],
        value: 'anything',
        expected: VALID,
      },
      {
        description: 'should handle single validator with valid value',
        validators: [validator],
        value: 'OK',
        expected: VALID,
      },
      {
        description: 'should handle single failing validator',
        validators: [validator],
        value: 'invalid-value',
        expected: { reasons: ['Failed validation.'] },
      },
    ];
    test.each(testCases)('$description', (testCase) => {
      expect(validateEach(testCase.validators, testCase.value)).toEqual(testCase.expected);
    });

    test('should return reasonMap when first validator returns reasonMap', () => {
      const validatorWithReasonMap: ValidatorFunction = () => ({
        reasonMap: { field: { reasons: ['Field error'] } },
      });
      expect(validateEach([validatorWithReasonMap], 'test')).toEqual({
        reasonMap: { field: { reasons: ['Field error'] } },
      });
    });
  });

  describe('validateKey', () => {
    test('should return valid when key validation passes', () => {
      const spec = { name: [validator] };
      const obj = { name: 'OK' };
      expect(validateKey(spec, 'name', obj)).toEqual(VALID);
    });

    test('should return invalid with reasons when key validation fails', () => {
      const spec = { name: [validator] };
      const obj = { name: 'NotOK' };
      expect(validateKey(spec, 'name', obj)).toEqual({
        reasons: ['Failed validation.'],
      });
    });

    test('should handle multiple validators with multiple failures', () => {
      const spec = { name: [validator, validator] };
      const obj = { name: 'NotOK' };
      expect(validateKey(spec, 'name', obj)).toEqual({
        reasons: ['Failed validation.', 'Failed validation.'],
      });
    });

    test('should validate key correctly with OK value', () => {
      const spec = { value: [validator] };
      const obj = { value: 'OK' };
      expect(validateKey(spec, 'value', obj)).toEqual(VALID);
    });

    test('should return invalid for non-OK value', () => {
      const spec = { value: [validator] };
      const obj = { value: 'different' };
      expect(validateKey(spec, 'value', obj)).toEqual({
        reasons: ['Failed validation.'],
      });
    });

    test('should handle single validator successfully', () => {
      const spec = { name: [validator] };
      const obj = { name: 'OK' };
      expect(validateKey(spec, 'name', obj)).toEqual(VALID);
    });

    test('should return VALID for undefined spec key', () => {
      const spec = {};
      const obj = { nonexistentKey: 'anything' };
      expect(validateKey(spec, 'nonexistentKey', obj)).toEqual(VALID);
    });

    test.each([
      { description: 'null', value: null },
      { description: 'undefined', value: undefined },
      { description: 'string', value: 'string' },
      { description: 'number', value: 123 },
    ])('should handle non-object value: $description', ({ value }) => {
      const spec = { name: [validator] };
      // When obj is not an object, objValue becomes undefined
      expect(validateKey(spec, 'name', value)).toEqual({
        reasons: ['Failed validation.'],
      });
    });
  });

  describe('validateObject', () => {
    const spec: ValidationSpec<TestPerson> = {
      firstName: [validator],
      lastName: [validator],
      phone: [validator],
      email: [validator],
      code: [validator],
    };

    const testCases = [
      {
        description: 'should validate a valid object',
        obj: {
          firstName: 'OK',
          lastName: 'OK',
          email: 'OK',
          phone: 'OK',
          code: 'OK',
        },
        expected: VALID,
      },
      {
        description: 'should validate an invalid object',
        obj: {
          firstName: 'NotOK',
          lastName: 'NotOK',
          email: 'NotOK',
          phone: 'NotOK',
          code: 'NotOK',
        },
        expected: {
          reasonMap: {
            firstName: { reasons: ['Failed validation.'] },
            lastName: { reasons: ['Failed validation.'] },
            email: { reasons: ['Failed validation.'] },
            phone: { reasons: ['Failed validation.'] },
            code: { reasons: ['Failed validation.'] },
          },
        },
      },
    ];
    test.each(testCases)('$description', (testCase) => {
      expect(validateObject(spec, testCase.obj)).toEqual(
        expect.objectContaining(testCase.expected),
      );
    });

    test('should return error for non-object inputs', () => {
      const spec: ValidationSpec<TestPerson> = {
        firstName: [validator],
      };

      expect(validateObject(spec, null)).toEqual({
        reasons: ['Value must be an object'],
      });

      expect(validateObject(spec, 'not an object')).toEqual({
        reasons: ['Value must be an object'],
      });

      expect(validateObject(spec, 123)).toEqual({
        reasons: ['Value must be an object'],
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
      street: [validator],
      city: [validator],
      zipCode: [validator],
      country: [validator],
    };

    const personWithAddressSpec: ValidationSpec<PersonWithAddress> = {
      name: [validator],
      address: addressSpec, // This is a nested ValidationSpec
      email: [validator],
    };

    const testCases = [
      {
        description: 'should validate valid nested object',
        obj: {
          name: 'OK',
          address: {
            street: 'OK',
            city: 'OK',
            zipCode: 'OK',
            country: 'OK',
          },
          email: 'OK',
        },
        expected: VALID,
      },
      {
        description: 'should validate nested object with all required fields',
        obj: {
          name: 'OK',
          address: {
            street: 'OK',
            city: 'OK',
            zipCode: 'OK',
            country: 'OK',
          },
          email: 'OK',
        },
        expected: VALID,
      },
      {
        description: 'should return errors for invalid nested object fields',
        obj: {
          name: 'NotOK', // Invalid: not "OK"
          address: {
            street: 'NotOK', // Invalid: not "OK"
            city: 'OK',
            zipCode: 'NotOK', // Invalid: not "OK"
            country: 'NotOK', // Invalid: not "OK"
          },
          email: 'NotOK', // Invalid: not "OK"
        },
        expected: {
          reasonMap: {
            name: { reasons: ['Failed validation.'] },
            address: {
              reasonMap: {
                street: { reasons: ['Failed validation.'] },
                zipCode: { reasons: ['Failed validation.'] },
                country: { reasons: ['Failed validation.'] },
              },
            },
            email: { reasons: ['Failed validation.'] },
          },
        },
      },
      {
        description: 'should handle nested object with single validation error',
        obj: {
          name: 'OK',
          address: {
            street: 'OK',
            city: 'OK',
            zipCode: 'NotOK', // Only this field is invalid
            country: 'OK',
          },
          email: 'OK',
        },
        expected: {
          reasonMap: {
            address: {
              reasonMap: {
                zipCode: { reasons: ['Failed validation.'] },
              },
            },
          },
        },
      },
    ];

    test.each(testCases)('$description', (testCase) => {
      const result = validateObject(personWithAddressSpec, testCase.obj);
      expect(result).toEqual(testCase.expected);
    });
  });

  describe('flattenReasonMap', () => {
    test('should flatten simple reason map', () => {
      const reasonMap = {
        name: { reasons: ['Name is required'] },
        email: { reasons: ['Invalid email'] },
      };
      const result = flattenReasonMap(reasonMap);
      expect(result).toEqual({
        '$.name': ['Name is required'],
        '$.email': ['Invalid email'],
      });
    });

    test('should flatten nested reason map', () => {
      const reasonMap = {
        user: {
          reasonMap: {
            name: { reasons: ['Name is required'] },
            contact: {
              reasonMap: {
                email: { reasons: ['Invalid email'] },
              },
            },
          },
        },
      };
      const result = flattenReasonMap(reasonMap);
      expect(result).toEqual({
        '$.user.name': ['Name is required'],
        '$.user.contact.email': ['Invalid email'],
      });
    });

    test('should handle reason map with prefix', () => {
      const reasonMap = {
        field: { reasons: ['Field error'] },
      };
      const result = flattenReasonMap(reasonMap, 'parent');
      expect(result).toEqual({
        '$.parent.field': ['Field error'],
      });
    });

    test('should handle empty reason map', () => {
      const result = flattenReasonMap({});
      expect(result).toEqual({});
    });

    test('should skip valid results', () => {
      const reasonMap = {
        validField: VALID,
        invalidField: { reasons: ['Error message'] },
      };
      const result = flattenReasonMap(reasonMap);
      expect(result).toEqual({
        '$.invalidField': ['Error message'],
      });
    });

    test('should handle mixed reasons and nested reasonMap', () => {
      const reasonMap = {
        topLevel: { reasons: ['Top level error'] },
        nested: {
          reasonMap: {
            inner: { reasons: ['Inner error'] },
          },
        },
      };
      const result = flattenReasonMap(reasonMap);
      expect(result).toEqual({
        '$.topLevel': ['Top level error'],
        '$.nested.inner': ['Inner error'],
      });
    });
  });

  describe('flatten', () => {
    test('should flatten reason map to string array', () => {
      const reasonMap = {
        name: { reasons: ['Name is required', 'Name too short'] },
        email: { reasons: ['Invalid email'] },
      };
      const result = flatten(reasonMap);
      expect(result).toEqual([
        '$.name: Name is required',
        '$.name: Name too short',
        '$.email: Invalid email',
      ]);
    });

    test('should handle nested structure', () => {
      const reasonMap = {
        user: {
          reasonMap: {
            profile: {
              reasonMap: {
                name: { reasons: ['Name required'] },
              },
            },
          },
        },
      };
      const result = flatten(reasonMap);
      expect(result).toEqual(['$.user.profile.name: Name required']);
    });

    test('should handle empty reason map', () => {
      const result = flatten({});
      expect(result).toEqual([]);
    });
  });
});

describe('validation.mergeValidatorResults', () => {
  test('merges top-level extra keys into reasonMap and combines reasons', () => {
    const left: Record<string, unknown> = {
      reasons: ['left-fail'],
      extra: { reasons: ['left-extra'] },
    };

    const right: Record<string, unknown> = {
      reasons: ['right-fail'],
      extra: { reasons: ['right-extra'] },
    };

    const merged = mergeValidatorResults(left, right);

    expect(merged.reasons).toEqual(expect.arrayContaining(['left-fail', 'right-fail']));

    expect(merged.reasonMap).toBeDefined();
    expect(merged.reasonMap!['extra']).toBeDefined();
    expect(merged.reasonMap!['extra'].reasons).toEqual(
      expect.arrayContaining(['left-extra', 'right-extra']),
    );
  });
});

describe('validation.validateObject $-spec merging', () => {
  test('merges $ reasonMap entries into per-key reasonMap when key exists', () => {
    const spec: ValidationSpec<Record<string, unknown>> = {
      a: [(_v: unknown) => ({ reasons: ['a-level'] })],
      $: [(_obj: unknown) => ({ reasonMap: { a: { reasons: ['dollar-level'] } } })],
    };

    const obj = { a: 'value' };

    const res = validateObject(spec, obj);

    expect(res.reasonMap).toBeDefined();
    const aRes = res.reasonMap!['a'];
    expect(aRes).toBeDefined();
    expect(aRes.reasons).toEqual(expect.arrayContaining(['a-level', 'dollar-level']));
  });

  test("includes $ reasonMap entries for keys that don't have their own failures", () => {
    const spec: ValidationSpec<Record<string, unknown>> = {
      $: [(_obj: unknown) => ({ reasonMap: { b: { reasons: ['dollar-b'] } } })],
    };

    const obj = { b: 'value' };

    const res = validateObject(spec, obj);

    expect(res.reasonMap).toBeDefined();
    const bRes = res.reasonMap!['b'];
    expect(bRes).toBeDefined();
    expect(bRes.reasons).toEqual(expect.arrayContaining(['dollar-b']));
  });
});
