/********************************************************************************
 * Core Validation Library Types and Functions
 ********************************************************************************/

type ValidatorResult = { valid: true } | { valid: false; reason: string };
type ValidatorResults = { valid: true } | { valid: false; reasons: string[] };
type ValidatorResultsSet<T> =
  | { valid: true }
  | { valid: false; reasons: Record<keyof T, ValidatorResults> };

export type ValidatorFunction = (value: unknown) => ValidatorResult;
export type ValidationSpec<T> = Record<keyof T, ValidatorFunction[]>;

/**
 * Validate a value against a validator function.
 *
 * @param func
 * @param value
 */
function validate(func: ValidatorFunction, value: unknown): ValidatorResult {
  return func(value);
}

/**
 * Validates a value against multiple validator functions and returns aggregated results.
 *
 * @param functions - Array of validator functions to apply to the value
 * @param value - The value to be validated
 * @returns ValidatorResults object containing validation status and reasons for failure
 */
function validateEach(functions: ValidatorFunction[], value: unknown): ValidatorResults {
  const reasons = functions
    .map((f) => f(value))
    .filter((r) => !r.valid)
    .map((r) => (r as { valid: false; reason: string }).reason);

  return reasons.length > 0 ? { valid: false, reasons } : { valid: true };
}

/**
 * Validates a specific key of an object using a validation specification.
 *
 * @template T - The type of the object being validated
 * @param spec - The validation specification defining rules for object properties
 * @param key - The specific key/property of the object to validate
 * @param obj - The object containing the property to be validated
 * @returns ValidatorResults object containing validation status and reasons for failure
 */
function validateKey<T>(spec: ValidationSpec<T>, key: keyof T, obj: T): ValidatorResults {
  return validateEach(spec[key], obj[key]);
}

/**
 * Validates all properties of an object against a validation specification.
 *
 * @template T - The type of the object being validated
 * @param spec - The validation specification defining rules for all object properties
 * @param obj - The object to be validated
 * @returns ValidatorResultsSet object containing validation status and property-specific reasons for failure
 */
function validateObject<T>(spec: ValidationSpec<T>, obj: T): ValidatorResultsSet<T> {
  const reasons = (Object.keys(spec) as (keyof T)[]).reduce(
    (acc, key) => {
      const result = validateEach(spec[key], obj[key]);
      if (!result.valid) {
        acc[key] = result;
      }
      return acc;
    },
    {} as Record<keyof T, ValidatorResults>,
  );

  return Object.keys(reasons).length > 0 ? { valid: false, reasons } : { valid: true };
}

/********************************************************************************
 * Common Validator Functions
 ********************************************************************************/

// Need to support dates, numbers. Nullable and undefined.
// Required vs. optional.

function isString(value: unknown): ValidatorResult {
  return typeof value === 'string' ? { valid: true } : { valid: false, reason: 'Must be a string' };
}

function minLength(min: number, reason?: string): ValidatorFunction {
  return length(min, Infinity, reason);
}

function maxLength(max: number, reason?: string): ValidatorFunction {
  return length(0, max, reason);
}

function length(min: number, max: number, reason?: string): ValidatorFunction {
  return (value: unknown): ValidatorResult => {
    if (value === null) {
      return { valid: false, reason: reason ?? `Value is null` };
    } else if (value === undefined) {
      return { valid: false, reason: reason ?? `Value is undefined` };
    }

    const valueIsString = typeof value === 'string';
    const valueIsArray = Array.isArray(value);

    if (valueIsString || valueIsArray) {
      if (value.length >= min && value.length <= max) {
        return { valid: true };
      } else {
        const reasonText = () => {
          if (reason) {
            return reason;
          }

          let rangeText = `between ${min} and ${max}`;
          if (min === 0) {
            rangeText = `at most ${max}`;
          } else if (max === Infinity) {
            rangeText = `at least ${min}`;
          }

          const unitText = valueIsString ? 'characters' : 'selections';
          return `Must contain ${rangeText} ${unitText}`;
        };

        return {
          valid: false,
          reason: reasonText(),
        };
      }
    } else {
      return { valid: false, reason: reason ?? 'Value does not have a length' };
    }
  };
}

function isInSet(set: string[], reason?: string): ValidatorFunction {
  return (value: unknown): ValidatorResult => {
    return typeof value === 'string' && set.includes(value)
      ? { valid: true }
      : { valid: false, reason: reason ?? `Must be one of ${set.join(', ')}` };
  };
}

function matches(regex: RegExp, error?: string): ValidatorFunction {
  return (value: unknown): ValidatorResult => {
    return typeof value === 'string' && regex.test(value)
      ? { valid: true }
      : { valid: false, reason: error ?? `Must match the pattern ${regex}` };
  };
}

function isEmailAddress(value: unknown): ValidatorResult {
  return matches(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Must be a valid email address')(value);
}

function isPhoneNumber(value: unknown): ValidatorResult {
  return matches(/^\d{10}$/, 'Must be a valid phone number')(value);
}

const V = {
  isEmailAddress,
  isInSet,
  isPhoneNumber,
  isString,
  length,
  matches,
  maxLength,
  minLength,
  validate,
  validateEach,
  validateKey,
  validateObject,
};

export default V;
