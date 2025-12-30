/********************************************************************************
 * Core Validation Library Types and Functions
 ********************************************************************************/
export type ValidatorReasonMap = Record<string, ValidatorResult>;

export type ValidatorResult = {
  valid?: true;
  reasons?: string[];
  reasonMap?: ValidatorReasonMap;
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
  const validatorResult = functions.map((f) => f(value)).filter((r) => !r.valid);

  if (!validatorResult.length) {
    return VALID;
  }
  return validatorResult.reduce((acc, result) => {
    return mergeValidatorResults(acc, result);
  }, {});
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
  const specValue = spec[key as keyof typeof spec];
  const objValue =
    typeof obj === 'object' && obj !== null ? (obj as Record<string, unknown>)[key] : undefined;

  if (Array.isArray(specValue)) {
    return validateEach(specValue as ValidatorFunction[], objValue);
  } else if (typeof specValue === 'object' && specValue !== null) {
    return validateObject(specValue as ValidationSpec<unknown>, objValue);
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

  // Both sides are invalid: merge reasons and reasonMap recursively
  const mergedReasons: string[] = [...(left.reasons || []), ...(right.reasons || [])];

  // Start from explicit reasonMap entries
  const leftMap: ValidatorReasonMap = { ...(left.reasonMap || {}) };
  const rightMap: ValidatorReasonMap = { ...(right.reasonMap || {}) };

  // Also include any "extra" top-level keys on the left/right that are ValidatorResult-like
  for (const [k, v] of Object.entries(left)) {
    if (k !== 'reasons' && k !== 'reasonMap' && v && typeof v === 'object' && !(k in leftMap)) {
      leftMap[k] = v as ValidatorResult;
    }
  }
  for (const [k, v] of Object.entries(right)) {
    if (k !== 'reasons' && k !== 'reasonMap' && v && typeof v === 'object' && !(k in rightMap)) {
      rightMap[k] = v as ValidatorResult;
    }
  }

  const allKeys = Array.from(new Set([...Object.keys(leftMap), ...Object.keys(rightMap)]));

  const mergedReasonMap: ValidatorReasonMap = {};
  for (const key of allKeys) {
    const l = leftMap[key];
    const r = rightMap[key];
    if (l && r) {
      mergedReasonMap[key] = mergeValidatorResults(l, r);
    } else if (l) {
      mergedReasonMap[key] = l;
    } else if (r) {
      mergedReasonMap[key] = r;
    }
  }

  const result: ValidatorResult = {};
  if (mergedReasons.length) {
    result.reasons = mergedReasons;
  }
  if (Object.keys(mergedReasonMap).length) {
    result.reasonMap = mergedReasonMap;
  }
  return result;
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

  const reasonMap: Record<string, ValidatorResult> = Object.keys(spec).reduce(
    (acc: Record<string, ValidatorResult>, key) => {
      const specValue = spec['$' as keyof typeof spec];
      const result =
        key === '$' && Array.isArray(specValue)
          ? validateEach(specValue as ValidatorFunction[], obj)
          : validateKey(spec, key, obj);
      if (!result.valid) {
        acc[key] = result;
      }
      return acc;
    },
    {},
  );

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
  const errors: [string, string[]][] = [];

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
  const pathsAndReasons: string[] = [];
  for (const [jsonPath, reasons] of Object.entries(flatMap)) {
    reasons.forEach((reason) => {
      pathsAndReasons.push(`${jsonPath}: ${reason}`);
    });
  }
  return pathsAndReasons;
}
