import { EMAIL_REGEX, PHONE_REGEX, WEBSITE_REGEX } from './regex';
import {
  ValidatorFunction,
  ValidatorResult,
  ValidationSpec,
  validateEach,
  validateObject,
  VALID,
} from './validation';

/********************************************************************************
 * Common Validator Functions
 ********************************************************************************/

/**
 * Creates a validator function from a validation specification.
 * This function takes a validation specification object and returns a validator function
 * that can be used to validate objects against that specification.
 *
 * @param {ValidationSpec<unknown>} s - The validation specification object defining the validation rules
 * @returns {ValidatorFunction} A validator function that validates objects against the provided specification
 */
function spec(s: ValidationSpec<unknown>): ValidatorFunction {
  return (obj: unknown): ValidatorResult => {
    return validateObject(s, obj);
  };
}

/**
 * Validates that a value is not set (either undefined or null).
 * This validator ensures that a field remains unset/empty, useful for fields that should not be provided.
 *
 * @param {unknown} value - The value to validate as not being set
 * @returns {ValidatorResult} Object containing validation status and reason for failure if the value is set
 */
function notSet(value: unknown): ValidatorResult {
  return value === undefined || value === null ? VALID : { reasons: ['Must not be set'] };
}

/**
 * Creates a conditional validator that skips validation based on a predicate function.
 * If the predicate function returns true for a given value, validation is skipped and the value is considered valid.
 * Otherwise, the provided validators are applied to the value.
 *
 * @param {(value: unknown) => boolean} func - The predicate function that determines whether to skip validation
 * @param {ValidatorFunction[]} validators - Array of validator functions to apply when the predicate returns false
 * @returns {ValidatorFunction} A validator function that conditionally applies validation based on the predicate
 */
function skip(
  func: (value: unknown) => boolean,
  validators: ValidatorFunction[],
): ValidatorFunction {
  return (value: unknown): ValidatorResult => {
    return func(value) ? VALID : validateEach(validators, value);
  };
}
/**
 * Creates a validator function that treats null values as valid and applies other validators otherwise.
 * This allows for nullable fields in validation schemas where null values are acceptable.
 *
 * @param {...ValidatorFunction[]} validators - Variable number of validator functions to apply when value is not null
 * @returns {ValidatorFunction} A validator function that allows null values and validates non-null values
 */
const nullable = (...validators: ValidatorFunction[]): ValidatorFunction =>
  skip((v) => v === null, validators);

/**
 * Creates a validator function that treats undefined values as valid and applies other validators otherwise.
 * This allows for optional fields in validation schemas where undefined values are acceptable.
 *
 * @param {...ValidatorFunction[]} validators - Variable number of validator functions to apply when value is not undefined
 * @returns {ValidatorFunction} A validator function that allows undefined values and validates defined values
 */
const optional = (...validators: ValidatorFunction[]): ValidatorFunction =>
  skip((v) => v === undefined, validators);

/**
 * Creates a validator function that checks if all elements in an array pass the provided validators.
 * Returns all validation errors from all invalid elements in the array.
 *
 * @param {...ValidatorFunction[]} validators - Variable number of validator functions to apply to each array element
 * @returns {ValidatorFunction} A validator function that validates each element in an array and collects all validation errors
 */
const arrayOf = (...validators: ValidatorFunction[]): ValidatorFunction => {
  return (value: unknown): ValidatorResult => {
    if (!Array.isArray(value)) {
      return { reasons: ['Value is not an array'] };
    }

    const allErrors: string[] = [];

    value.forEach((element, index) => {
      const result = validateEach(validators, element);
      if (!result.valid && result.reasons) {
        const reasons = result.reasons.map((r) => `Element at index ${index}: ${r}`);
        allErrors.push(...reasons);
      }
    });

    return allErrors.length > 0 ? { reasons: allErrors } : VALID;
  };
};

/**
 * Creates a validator function that checks if a string or array has at least a minimum length.
 *
 * @param {number} min - The minimum required length
 * @param {string} reason - Optional custom error message to display when validation fails
 * @returns {ValidatorFunction} A validator function that checks minimum length
 */
function minLength(min: number, reason?: string): ValidatorFunction {
  return length(min, Infinity, reason);
}

/**
 * Creates a validator function that checks if a string or array has at most a maximum length.
 *
 * @param {number} max - The maximum allowed length
 * @param {string} reason - Optional custom error message to display when validation fails
 * @returns {ValidatorFunction} A validator function that checks maximum length
 */
function maxLength(max: number, reason?: string): ValidatorFunction {
  return length(0, max, reason);
}

function exactLength(len: number, reason?: string): ValidatorFunction {
  return length(len, len, reason);
}

/**
 * Type predicate to check if a value has a length property.
 *
 * @param value - The value to check for a length property
 * @returns {boolean} True if the value has a length property, false otherwise
 */
function hasLength(value: unknown): value is { length: number } {
  return (
    typeof value === 'string' || (typeof value === 'object' && value !== null && 'length' in value)
  );
}

/**
 * Creates a validator function that checks if a string or array length is within a specified range.
 *
 * @param {number} min - The minimum required length
 * @param {number} max - The maximum allowed length
 * @param {string} [reason] - Optional custom error message to display when validation fails
 * @returns {ValidatorFunction} A validator function that checks length within the specified range
 */
function length(min: number, max: number, reason?: string): ValidatorFunction {
  return (value: unknown): ValidatorResult => {
    if (hasLength(value)) {
      if (value.length >= min && value.length <= max) {
        return VALID;
      }

      if (reason) {
        return { reasons: [reason] };
      }

      let rangeText = `between ${min} and ${max}`;
      if (min === 0) {
        rangeText = `at most ${max}`;
      } else if (max === Infinity) {
        rangeText = `at least ${min}`;
      } else if (min === max) {
        rangeText = `exactly ${min}`;
      }

      const unitText = typeof value === 'string' ? 'characters' : 'selections';

      return { reasons: [`Must contain ${rangeText} ${unitText}`] };
    }

    if (value === null) {
      return { reasons: [reason ?? `Value is null`] };
    } else if (value === undefined) {
      return { reasons: [reason ?? `Value is undefined`] };
    } else {
      return { reasons: [reason ?? 'Value does not have a length'] };
    }
  };
}

/**
 * Creates a validator function that checks whether a value is in a set of allowed strings.
 *
 * @param {string[]} set - The array of allowed values
 * @param {string} [reason] - Optional custom error message to display when validation fails
 * @returns {ValidatorFunction} A validator function that checks if value is in the allowed set
 */
function isInSet<T>(set: T[], reason?: string): ValidatorFunction {
  return (value: unknown): ValidatorResult => {
    return set.includes(value as T)
      ? VALID
      : { reasons: [reason ?? `Must be one of ${set.join(', ')}`] };
  };
}

/**
 * Creates a validator function that checks if a string value matches a regular expression pattern.
 *
 * @param {RegExp} regex - The regular expression pattern to match against
 * @param {string} [reason] - Optional custom reason to display when validation fails
 * @returns {ValidatorFunction} A validator function that checks pattern matching
 */
function matches(regex: RegExp, reason?: string): ValidatorFunction {
  return (value: unknown): ValidatorResult => {
    return typeof value === 'string' && regex.test(value)
      ? VALID
      : { reasons: [reason ?? `Must match the pattern ${regex}`] };
  };
}

/**
 * Validates whether a value is a valid email address format.
 *
 * @param {unknown} value - The value to be validated as an email address
 * @returns {ValidatorResult} Object containing validation status and reason for failure if invalid
 */
function isEmailAddress(value: unknown): ValidatorResult {
  return matches(EMAIL_REGEX, 'Must be a valid email address')(value);
}

/**
 * Validates whether a value is a valid website address format.
 *
 * @param {unknown} value - The value to be validated as a website address
 * @returns {ValidatorResult} Object containing validation status and reason for failure if invalid
 */
function isWebsiteAddress(value: unknown): ValidatorResult {
  return matches(WEBSITE_REGEX, 'Must be a valid website address')(value);
}

/**
 * Validates whether a value is a valid 10-digit phone number format.
 *
 * @param {unknown} value - The value to be validated as a phone number
 * @returns {ValidatorResult} Object containing validation status and reason for failure if invalid
 */
function isPhoneNumber(value: unknown): ValidatorResult {
  return matches(PHONE_REGEX, 'Must be a valid phone number')(value);
}

const Validators = {
  arrayOf,
  exactLength,
  isEmailAddress,
  isWebsiteAddress,
  isInSet,
  isPhoneNumber,
  length,
  matches,
  maxLength,
  minLength,
  notSet,
  nullable,
  skip,
  spec,
  optional,
};

export default Validators;
