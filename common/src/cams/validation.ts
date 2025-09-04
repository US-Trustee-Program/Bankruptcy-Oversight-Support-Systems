/********************************************************************************
 * Core Validation Library Types and Functions
 ********************************************************************************/

export type ValidatorResult = {
  valid?: true;
  reason?: string;
  reasonMap?: Record<string, ValidatorResult>;
};

export type ValidatorFunction = (value: unknown) => ValidatorResult;

export type ValidationSpec<T> = {
  [K in keyof T]?: T[K] extends object
    ? ValidatorFunction[] | ValidationSpec<T[K]>
    : ValidatorFunction[];
};

export const VALID: ValidatorResult = { valid: true } as const;

/**
 * Validate a value against a validator function.
 *
 * @param func
 * @param value
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

  if (reasons.length > 0) {
    return reasons[0];
  }

  return VALID;
}

/**
 * Validates a specific key of an object using a validation specification.
 * Handles both validator function arrays and nested validation specs.
 *
 * @template T - The type of the object being validated
 * @param spec - The validation specification defining rules for object properties
 * @param key - The specific key/property of the object to validate
 * @param obj - The object containing the property to be validated
 * @returns ValidatorResults an object containing validation status and reasons for failure
 */
export function validateKey(
  spec: ValidationSpec<unknown>,
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

/**
 * Validates all properties of an object against a validation specification.
 * Handles both validator function arrays and nested validation specs.
 *
 * @template T - The type of the object being validated
 * @param spec - The validation specification defining rules for all object properties
 * @param obj - The object to be validated
 * @returns ValidatorResultsSet object containing validation status and property-specific reasons for failure
 */
export function validateObject(spec: ValidationSpec<unknown>, obj: unknown): ValidatorResult {
  if (typeof obj !== 'object' || obj === null) {
    return { reason: 'Value must be an object' };
  }

  const reasonMap = Object.keys(spec).reduce((acc, key) => {
    const result = validateKey(spec, key, obj);
    if (!result.valid) {
      acc[key] = result;
    }
    return acc;
  }, {});

  return Object.keys(reasonMap).length > 0 ? { reasonMap } : VALID;
}

export function flattenReasonMap(
  reasonMap: Record<string, ValidatorResult>,
  prefix = '',
): Record<string, string[]> {
  const errors = [];

  Object.entries(reasonMap).forEach(([field, result]) => {
    if (result && !result.valid) {
      const fieldPath = prefix ? `${prefix}.${field}` : field;

      if (result.reason) {
        errors.push([fieldPath, [result.reason]]);
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
  for (const [path, reasons] of Object.entries(flatMap)) {
    const jsonPath = `$.${path}`;
    reasons.forEach((reason) => {
      pathsAndReasons.push(`${jsonPath}: ${reason}`);
    });
  }
  return pathsAndReasons;
}
