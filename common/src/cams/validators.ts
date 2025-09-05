import { EMAIL_REGEX, PHONE_REGEX } from './regex';
import {
  validateEach,
  ValidatorFunction,
  ValidatorResult,
  VALID,
  ValidationSpec,
  validateObject,
} from './validation';

/********************************************************************************
 * Common Validator Functions
 ********************************************************************************/
function spec(s: ValidationSpec<unknown>): ValidatorFunction {
  return (obj: unknown): ValidatorResult => {
    return validateObject(s, obj);
  };
}

/**
 * Creates a validator function that treats undefined values as valid and applies other validators otherwise.
 * This allows for optional fields in validation schemas where undefined values are acceptable.
 *
 * @param {...ValidatorFunction[]} validators - Variable number of validator functions to apply when value is not undefined
 * @returns {ValidatorFunction} A validator function that allows undefined values and validates defined values
 */
function optional(...validators: ValidatorFunction[]): ValidatorFunction {
  return (value: unknown): ValidatorResult => {
    if (value === undefined) {
      return VALID;
    } else {
      return validateEach(validators, value);
    }
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
 * Creates a validator function that treats null values as valid and applies other validators otherwise.
 * This allows for nullable fields in validation schemas where null values are acceptable.
 *
 * @param {...ValidatorFunction[]} validators - Variable number of validator functions to apply when value is not null
 * @returns {ValidatorFunction} A validator function that allows null values and validates non-null values
 */
function nullable(...validators: ValidatorFunction[]): ValidatorFunction {
  return (value: unknown): ValidatorResult => {
    if (value === null) {
      return VALID;
    } else {
      return validateEach(validators, value);
    }
  };
}

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
 * @param {string} reason
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
 * @param value
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
      return { reasons: [`Value is null`] };
    } else if (value === undefined) {
      return { reasons: [`Value is undefined`] };
    } else {
      return { reasons: ['Value does not have a length'] };
    }
  };
}

/**
 * Creates a validator function that checks whether a value is in a set of allowed strings.
 *
 * @param {string[]} set
 * @param {string} [reason]
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
 * Validates whether a value is a valid 10-digit phone number format.
 *
 * @param {unknown} value - The value to be validated as a phone number
 * @returns {ValidatorResult} Object containing validation status and reason for failure if invalid
 */
function isPhoneNumber(value: unknown): ValidatorResult {
  return matches(PHONE_REGEX, 'Must be a valid phone number')(value);
}

const Validators = {
  exactLength,
  isEmailAddress,
  isInSet,
  isPhoneNumber,
  length,
  matches,
  maxLength,
  minLength,
  notSet,
  nullable,
  spec,
  optional,
};

export default Validators;
