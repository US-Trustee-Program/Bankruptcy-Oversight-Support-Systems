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

// TODO: Need to support dates, numbers. Nullable and undefined. Required vs. optional.

/**
 * Validates whether a value is a string.
 *
 * @param {unknown} value - The value to be validated
 * @returns {ValidatorResult} Object containing validation status and reason for failure if invalid
 */
function isString(value: unknown): ValidatorResult {
  return typeof value === 'string' ? { valid: true } : { valid: false, reason: 'Must be a string' };
}

/**
 * Creates a validator function that checks if a string or array has at least a minimum length.
 *
 * @param {number} min - The minimum required length
 * @returns {ValidatorFunction} A validator function that checks minimum length
 */
function minLength(min: number): ValidatorFunction {
  return length(min, Infinity);
}

/**
 * Creates a validator function that checks if a string or array has at most a maximum length.
 *
 * @param {number} max - The maximum allowed length
 * @returns {ValidatorFunction} A validator function that checks maximum length
 */
function maxLength(max: number): ValidatorFunction {
  return length(0, max);
}

/**
 * Creates a validator function that checks if a string or array length is within a specified range.
 *
 * @param {number} min - The minimum required length
 * @param {number} max - The maximum allowed length
 * @returns {ValidatorFunction} A validator function that checks length within the specified range
 */
function length(min: number, max: number): ValidatorFunction {
  return (value: unknown): ValidatorResult => {
    if (value === null) {
      return { valid: false, reason: `Value is null` };
    } else if (value === undefined) {
      return { valid: false, reason: `Value is undefined` };
    }

    const valueIsString = typeof value === 'string';
    const valueIsArray = Array.isArray(value);
    const isTypeWithLength = valueIsString || valueIsArray;

    if (!isTypeWithLength) {
      return { valid: false, reason: 'Value does not have a length' };
    }

    if (value.length >= min && value.length <= max) {
      return { valid: true };
    }

    const reasonText = () => {
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
  };
}

/**
 * Creates a validator function that checks whether a value is in a set of allowed strings.
 *
 * @param {string[]} set
 * @param {string} [reason]
 */
function isInSet(set: string[], reason?: string): ValidatorFunction {
  return (value: unknown): ValidatorResult => {
    return typeof value === 'string' && set.includes(value)
      ? { valid: true }
      : { valid: false, reason: reason ?? `Must be one of ${set.join(', ')}` };
  };
}

/**
 * Creates a validator function that checks if a string value matches a regular expression pattern.
 *
 * @param {RegExp} regex - The regular expression pattern to match against
 * @param {string} [error] - Optional custom error message to display when validation fails
 * @returns {ValidatorFunction} A validator function that checks pattern matching
 */
function matches(regex: RegExp, error?: string): ValidatorFunction {
  return (value: unknown): ValidatorResult => {
    return typeof value === 'string' && regex.test(value)
      ? { valid: true }
      : { valid: false, reason: error ?? `Must match the pattern ${regex}` };
  };
}

/**
 * Validates whether a value is a valid email address format.
 *
 * @param {unknown} value - The value to be validated as an email address
 * @returns {ValidatorResult} Object containing validation status and reason for failure if invalid
 */
function isEmailAddress(value: unknown): ValidatorResult {
  return matches(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Must be a valid email address')(value);
}

/**
 * Validates whether a value is a valid 10-digit phone number format.
 *
 * @param {unknown} value - The value to be validated as a phone number
 * @returns {ValidatorResult} Object containing validation status and reason for failure if invalid
 */
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
