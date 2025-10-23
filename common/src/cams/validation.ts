/********************************************************************************
 * Core Validation Library Types and Functions
 ********************************************************************************/

export type ValidatorResult = {
  valid?: true;
  reasons?: string[];
  reasonMap?: Record<string, ValidatorResult>;
};

export type ValidatorFunction = (value: unknown) => ValidatorResult;

type UnionRoot<T> = T & { $: unknown };

export type ValidationSpec<T> = {
  [K in keyof UnionRoot<T>]?: UnionRoot<T>[K] extends object
    ? ValidatorFunction[] | ValidationSpec<UnionRoot<T>[K]>
    : ValidatorFunction[];
};

export const VALID: ValidatorResult = { valid: true } as const;

/**
 * Validate a value against a validator function.
 *
 * @param func - The validator function to apply
 * @param value - The value to be validated
 * @returns {ValidatorResult} The result of the validation
 */
export function validate(func: ValidatorFunction, value: unknown): ValidatorResult {
  return func(value);
}

/**
 * Validates a value against multiple validator functions. Only returns the first failure reason found.
 *
 * @param functions - Array of validator functions to apply to the value
 * @param value - The value to be validated
 * @returns ValidatorResults object containing validation status and reason for failure
 */
export function validateEach(functions: ValidatorFunction[], value: unknown): ValidatorResult {
  if (!functions) {
    return VALID;
  }
  const reasons = functions.map((f) => f(value)).filter((r) => !r.valid);

  if (!reasons.length) {
    return VALID;
  }
  if (reasons[0].reasonMap) {
    return reasons[0];
  } else {
    return { reasons: reasons.flatMap((r) => r.reasons) };
  }
}

/**
 * Validates a specific key of an object using a validation specification.
 * Handles both validator function arrays and nested validation specs.
 *
 * @template T - The type of the object being validated
 * @param spec - The validation specification defining rules for object properties
 * @param key - The specific key/property of the object to validate
 * @param obj - The object containing the property to be validated
 * @returns {ValidatorResult} An object containing validation status and reasons for failure
 */
export function validateKey<T = unknown>(
  spec: ValidationSpec<T>,
  key: string,
  obj: unknown,
): ValidatorResult {
  if (Array.isArray(spec[key])) {
    return validateEach(spec[key], obj[key]);
  } else if (typeof spec[key] === 'object') {
    return validateObject(spec[key], obj[key]);
  } else {
    return VALID;
  }
}

export function mergeValidatorResults(
  left: ValidatorResult,
  right: ValidatorResult,
): ValidatorResult {
  if (left.valid && right.valid) {
    return VALID;
  }
  if (!right.valid && left.valid) {
    return right;
  }
  if (!left.valid && right.valid) {
    return left;
  }
  return { reasons: ['TDB - Merge not implemented'] };
}

/**
 * Validates all properties of an object against a validation specification.
 * Handles both validator function arrays and nested validation specs.
 *
 * @template T - The type of the object being validated
 * @param spec - The validation specification defining rules for all object properties
 * @param obj - The object to be validated
 * @returns {ValidatorResult} Object containing validation status and property-specific reasons for failure
 */
export function validateObject(spec: ValidationSpec<unknown>, obj: unknown): ValidatorResult {
  if (typeof obj !== 'object' || obj === null) {
    return { reasons: ['Value must be an object'] };
  }

  if (spec === null || spec === undefined) {
    return { reasons: ['No validation specification provided'] };
  }

  const reasonMap: ValidatorResult = Object.keys(spec).reduce((acc, key) => {
    const result = key === '$' ? validateEach(spec['$'], obj) : validateKey(spec, key, obj);
    if (!result.valid) {
      acc[key] = result;
    }
    return acc;
  }, {});

  const $reasonMap = reasonMap['$']?.['reasonMap'];

  if ($reasonMap) {
    for (const key of Object.keys($reasonMap)) {
      if (key in reasonMap) {
        reasonMap[key] = mergeValidatorResults(reasonMap[key], $reasonMap[key]);
      } else {
        reasonMap[key] = $reasonMap[key];
      }
    }
  }

  return Object.keys(reasonMap).length > 0 ? ({ reasonMap } as ValidatorResult) : VALID;
}

export function flattenReasonMap(
  reasonMap: Record<string, ValidatorResult>,
  prefix = '',
): Record<string, string[]> {
  const errors = [];

  Object.entries(reasonMap).forEach(([field, result]) => {
    if (result && !result.valid) {
      const fieldPath = prefix ? `${prefix}.${field}` : field;

      if (result.reasons) {
        const jsonPath = `$.${fieldPath}`;
        errors.push([jsonPath, result.reasons]);
      }

      if (result.reasonMap) {
        for (const record of Object.entries(flattenReasonMap(result.reasonMap, fieldPath))) {
          errors.push(record);
        }
      }
    }
  });

  return Object.fromEntries(errors);
}

export function flatten(reasonMap: Record<string, ValidatorResult>): string[] {
  const flatMap = flattenReasonMap(reasonMap);
  const pathsAndReasons = [];
  for (const [jsonPath, reasons] of Object.entries(flatMap)) {
    reasons.forEach((reason) => {
      pathsAndReasons.push(`${jsonPath}: ${reason}`);
    });
  }
  return pathsAndReasons;
}
