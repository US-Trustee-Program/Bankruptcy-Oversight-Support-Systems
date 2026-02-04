import {
  ValidatorFunction,
  ValidatorResult,
  ValidationSpec,
  validateEach,
  validateObject,
  VALID,
} from './validation';
import DateHelper from '../date-helper';

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
 * Creates a validator function that trims string values before applying other validators.
 * This is useful for fields where leading/trailing whitespace should be ignored during validation.
 *
 * @param {...ValidatorFunction[]} validators - Variable number of validator functions to apply to the trimmed value
 * @returns {ValidatorFunction} A validator function that trims strings before validation
 */
function trimmed(...validators: ValidatorFunction[]): ValidatorFunction {
  return (value: unknown): ValidatorResult => {
    const trimmedValue = typeof value === 'string' ? value.trim() : value;
    return validateEach(validators, trimmedValue);
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
/**
 * Helper function to pluralize a unit based on count.
 *
 * @param {number} count - The count to determine pluralization
 * @param {string} unit - The singular form of the unit
 * @returns {string} The unit with 's' appended if count is not 1
 */
function pluralize(count: number, unit: string): string {
  return count === 1 ? unit : unit + 's';
}

function length(min: number, max: number, reason?: string): ValidatorFunction {
  return (value: unknown): ValidatorResult => {
    if (hasLength(value)) {
      if (value.length >= min && value.length <= max) {
        return VALID;
      }

      if (reason) {
        return { reasons: [reason] };
      }

      const unitText = typeof value === 'string' ? 'character' : 'selection';

      // Generate UX-approved messages
      if (min === 0) {
        // maxLength case
        return { reasons: [`Max length ${max} ${pluralize(max, unitText)}`] };
      } else if (max === Infinity) {
        // minLength case
        return { reasons: [`Min length ${min} ${pluralize(min, unitText)}`] };
      } else if (min === max) {
        // exactLength case
        return { reasons: [`Should be ${min} ${pluralize(min, unitText)} in length`] };
      } else {
        // range case
        return { reasons: [`Must be between ${min} and ${max} ${pluralize(max, unitText)}`] };
      }
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
 * Validates whether a value is a valid date in YYYY-MM-DD format.
 * Checks both format and if the date is actually valid (e.g., not Feb 30).
 *
 * @param {unknown} value - The value to be validated as a date
 * @returns {ValidatorResult} Object containing validation status and reason for failure if invalid
 */
function isValidDate(value: unknown): ValidatorResult {
  if (typeof value !== 'string') {
    return { reasons: ['Must be a string'] };
  }

  const isCompleteDate = /^\d{4}-\d{2}-\d{2}$/.test(value);
  if (!isCompleteDate) {
    return { reasons: ['Must be in YYYY-MM-DD format'] };
  }

  const date = new Date(value);
  if (isNaN(date.getTime())) {
    return { reasons: ['Must be a valid date'] };
  }

  const isoString = date.toISOString().split('T')[0];
  if (isoString !== value) {
    return { reasons: ['Must be a valid date'] };
  }

  return VALID;
}

/**
 * Creates a validator function that checks if a date is within a specified range.
 * Validates that the date is after the minimum date and before the maximum date if provided.
 * Returns specific error messages with formatted dates (MM/DD/YYYY).
 *
 * @param {string} [min] - The minimum allowed date in YYYY-MM-DD format
 * @param {string} [max] - The maximum allowed date in YYYY-MM-DD format
 * @returns {ValidatorFunction} A validator function that checks date range
 */
function dateMinMax(min?: string, max?: string): ValidatorFunction {
  return (value: unknown): ValidatorResult => {
    const dateCheck = isValidDate(value);
    if (!dateCheck.valid) {
      return dateCheck;
    }

    const date = new Date(value as string);

    if (min) {
      const minDate = new Date(min);
      if (date < minDate) {
        const formattedMin = DateHelper.formatDate(min);
        return { reasons: [`Must be on or after ${formattedMin}.`] };
      }
    }

    if (max) {
      const maxDate = new Date(max);
      if (date > maxDate) {
        const formattedMax = DateHelper.formatDate(max);
        return { reasons: [`Must be on or before ${formattedMax}.`] };
      }
    }

    return VALID;
  };
}

/**
 * Creates a validator function that checks if a date is before a specified comparison date.
 *
 * @param {string} compareDate - The comparison date in YYYY-MM-DD format
 * @param {string} [reason] - Optional custom error message
 * @returns {ValidatorFunction} A validator function that checks if date is before compareDate
 */
function dateBefore(compareDate: string, reason?: string): ValidatorFunction {
  return (value: unknown): ValidatorResult => {
    const dateCheck = isValidDate(value);
    if (!dateCheck.valid) {
      return dateCheck;
    }

    const date = new Date(value as string);
    const compare = new Date(compareDate);

    return date < compare ? VALID : { reasons: [reason ?? `Date must be before ${compareDate}`] };
  };
}

/**
 * Creates a validator function that checks if a date is after a specified comparison date.
 *
 * @param {string} compareDate - The comparison date in YYYY-MM-DD format
 * @param {string} [reason] - Optional custom error message
 * @returns {ValidatorFunction} A validator function that checks if date is after compareDate
 */
function dateAfter(compareDate: string, reason?: string): ValidatorFunction {
  return (value: unknown): ValidatorResult => {
    const dateCheck = isValidDate(value);
    if (!dateCheck.valid) {
      return dateCheck;
    }

    const date = new Date(value as string);
    const compare = new Date(compareDate);

    return date > compare ? VALID : { reasons: [reason ?? `Date must be after ${compareDate}`] };
  };
}

/**
 * Creates a validator function that checks if a date is not too far in the future.
 * Validates that the date is within a specified number of years from now.
 *
 * @param {number} years - The maximum number of years in the future allowed
 * @param {string} [reason] - Optional custom error message
 * @returns {ValidatorFunction} A validator function that checks future date threshold
 */
function futureDateWithinYears(years: number, reason?: string): ValidatorFunction {
  return (value: unknown): ValidatorResult => {
    const dateCheck = isValidDate(value);
    if (!dateCheck.valid) {
      return dateCheck;
    }

    const date = new Date(value as string);
    const now = new Date();
    const thresholdDate = new Date(now.getFullYear() + years, now.getMonth(), now.getDate());

    return date <= thresholdDate
      ? VALID
      : { reasons: [reason ?? `Date must be within ${years} years from today`] };
  };
}

/**
 * Combines multiple validator functions into a single validator function.
 * All validators are executed and their results are merged.
 *
 * @param {...ValidatorFunction[]} validators - Variable number of validator functions to combine
 * @returns {ValidatorFunction} A single validator function that applies all provided validators
 */
function useValidators(...validators: ValidatorFunction[]): ValidatorFunction {
  return (value: unknown): ValidatorResult => validateEach(validators, value);
}

/**
 * Interface for the chainable validator builder returned by checkFirst.
 * Allows adding additional validators through the then() method.
 */
export interface ValidatorChain extends ValidatorFunction {
  /**
   * Adds additional validators to run after the initial validators pass.
   * @param validators - Variable number of validator functions to run if initial validators pass
   * @returns A ValidatorFunction that runs initial validators first, then these validators
   */
  then(...validators: ValidatorFunction[]): ValidatorFunction;
}

/**
 * Creates a chainable validator that runs initial validators first.
 * Only if the initial validators pass will the validators in .then() be executed.
 * Currently supports one .then() call.
 *
 * @example
 * const validator = V.checkFirst(
 *   V.minLength(1, 'Field is required')
 * ).then(
 *   V.maxLength(50),
 *   V.matches(/pattern/)
 * );
 *
 * @param {...ValidatorFunction[]} initialValidators - Initial validator(s) to run first
 * @returns {ValidatorChain} A chainable validator with a .then() method
 */
function checkFirst(...initialValidators: ValidatorFunction[]): ValidatorChain {
  // Create the base validator function that just runs initial validators
  const validatorFn = (value: unknown): ValidatorResult => {
    return validateEach(initialValidators, value);
  };

  // Add the then() method
  const chain: ValidatorChain = Object.assign(validatorFn, {
    then(...nextValidators: ValidatorFunction[]): ValidatorFunction {
      // Return a new validator that runs initial validators first,
      // then runs next validators only if initial ones pass
      return (value: unknown): ValidatorResult => {
        // Run initial validators first
        const initialResult = validateEach(initialValidators, value);

        // If initial validators fail, return immediately
        if (!initialResult.valid) {
          return initialResult;
        }

        // If initial validators pass, run the next set of validators
        return validateEach(nextValidators, value);
      };
    },
  });

  return chain;
}

const Validators = {
  arrayOf,
  checkFirst,
  dateAfter,
  dateBefore,
  dateMinMax,
  exactLength,
  futureDateWithinYears,
  isValidDate,
  isInSet,
  length,
  matches,
  maxLength,
  minLength,
  notSet,
  nullable,
  optional,
  skip,
  spec,
  trimmed,
  useValidators,
};

export default Validators;
