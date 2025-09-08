import { VALID, ValidationSpec, ValidatorFunction, ValidatorResult } from '../../cams/validation';

/**
 * Validate a value against a validator function.
 *
 * @param func - The validator function to apply
 * @param value - The value to be validated
 * @returns {ValidatorResult} The result of the validation
 */
function validate(func: ValidatorFunction, value: unknown): ValidatorResult {
  return func(value);
}

/**
 * Validates a value against multiple validator functions. Only returns the first failure reason found.
 *
 * @param functions - Array of validator functions to apply to the value
 * @param value - The value to be validated
 * @returns ValidatorResults object containing validation status and reason for failure
 */
function validateEach(functions: ValidatorFunction[], value: unknown): ValidatorResult {
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
    return { reasons: reasons.map((r) => r.reasons).flat() };
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
function validateKey(spec: ValidationSpec<unknown>, key: string, obj: unknown): ValidatorResult {
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
 * @returns {ValidatorResult} Object containing validation status and property-specific reasons for failure
 */
function validateObject(spec: ValidationSpec<unknown>, obj: unknown): ValidatorResult {
  if (typeof obj !== 'object' || obj === null) {
    return { reasons: ['Value must be an object'] };
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

function flattenReasonMap(
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

function flatten(reasonMap: Record<string, ValidatorResult>): string[] {
  const flatMap = flattenReasonMap(reasonMap);
  const pathsAndReasons = [];
  for (const [jsonPath, reasons] of Object.entries(flatMap)) {
    reasons.forEach((reason) => {
      pathsAndReasons.push(`${jsonPath}: ${reason}`);
    });
  }
  return pathsAndReasons;
}

export const Validator = {
  flatten,
  flattenReasonMap,
  validate,
  validateEach,
  validateKey,
  validateObject,
};

export default Validator;
