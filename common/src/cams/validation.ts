/********************************************************************************
 * Core Validation Library Types and Functions
 **************************************************************************/

// Base result for leaf node validation (array of validator functions applied to a single property)
export type LeafValidatorResult =
  | {
      valid: true;
    }
  | {
      valid: false;
      reasons: string[];
    };

// Result for validating an entire object - maps property names to their validation results
export type ObjectValidatorResult =
  | {
      valid: true;
    }
  | {
      valid: false;
      reasonsMap: Record<string, ValidatorResult>;
    };

// Union type representing any validator result (leaf or object)
export type ValidatorResult = LeafValidatorResult | ObjectValidatorResult;

// Function signature for individual validator functions (always return leaf results)
export type ValidatorFunction = (value: unknown) => LeafValidatorResult;

// Type for nested validation specs - allows for recursive object validation
export type ValidationSpec<T> = {
  [K in keyof T]?: T[K] extends object
    ? ValidatorFunction[] | ValidationSpec<T[K]>
    : ValidatorFunction[];
};

const VALID_RESULT: LeafValidatorResult = { valid: true } as const;

/**
 * Validate a value against a validator function.
 *
 * @param func
 * @param value
 */
function validate(func: ValidatorFunction, value: unknown): LeafValidatorResult {
  return func(value);
}

/**
 * Validates a value against multiple validator functions and returns aggregated results.
 *
 * @param functions - Array of validator functions to apply to the value
 * @param value - The value to be validated
 * @returns LeafValidatorResult object containing validation status and reasons for failure
 */
function validateEach(functions: ValidatorFunction[], value: unknown): LeafValidatorResult {
  if (!functions) {
    return VALID_RESULT;
  }
  const reasons = functions
    .map((f) => f(value))
    .filter((r) => !r.valid)
    .map((r) => (r as { valid: false; reasons: string[] }).reasons)
    .flat();

  return reasons.length > 0 ? { valid: false, reasons } : VALID_RESULT;
}

/**
 * Validates a specific key of an object using a validation specification.
 * Handles both validator function arrays and nested validation specs.
 *
 * @template T - The type of the object being validated
 * @param spec - The validation specification defining rules for object properties
 * @param key - The specific key/property of the object to validate
 * @param obj - The object containing the property to be validated
 * @returns ValidatorResult containing validation status and reasons for failure
 */
function validateKey<T>(spec: ValidationSpec<T>, key: keyof T, obj: T): ValidatorResult {
  const rule = spec[key];
  if (!rule) {
    return VALID_RESULT;
  }

  // Check if rule is an array of validator functions
  if (Array.isArray(rule)) {
    return validateEach(rule, obj[key]);
  } else {
    // rule is a nested ValidationSpec, recursively validate the nested object
    return validateObject(rule as ValidationSpec<unknown>, obj[key]);
  }
}

/**
 * Validates all properties of an object against a validation specification.
 * Handles both validator function arrays and nested validation specs.
 *
 * @template T - The type of the object being validated
 * @param spec - The validation specification defining rules for all object properties
 * @param obj - The object to be validated
 * @returns ObjectValidatorResult containing validation status and property-specific reasons for failure
 */
function validateObject<T>(spec: ValidationSpec<T>, obj: unknown): ObjectValidatorResult {
  const reasonsMap: Record<string, ValidatorResult> = {};

  for (const key of Object.keys(spec) as (keyof T)[]) {
    const rule = spec[key];
    if (!rule) {
      continue;
    }

    let result: ValidatorResult;

    // Check if rule is an array of validator functions
    if (Array.isArray(rule)) {
      result = validateEach(rule, (obj as Record<string, unknown>)[String(key)]);
    } else {
      // rule is a nested ValidationSpec - directly use the result
      result = validateObject(
        rule as ValidationSpec<unknown>,
        (obj as Record<string, unknown>)[String(key)],
      );
    }

    if (!result.valid) {
      reasonsMap[String(key)] = result;
    }
  }

  return Object.keys(reasonsMap).length > 0 ? { valid: false, reasonsMap } : { valid: true };
}

/**
 * Recursively extracts all validation error messages from a ValidatorResult.
 * Handles both leaf results (with string reasons) and nested object results.
 */
function extractValidationErrors(result: ValidatorResult, fieldPath = ''): string[] {
  const errors: string[] = [];

  if (!result.valid) {
    // Check if this is a leaf result with string reasons
    if ('reasons' in result && Array.isArray(result.reasons)) {
      const prefix = fieldPath ? `${fieldPath}: ` : '';
      errors.push(...result.reasons.map((reason) => `${prefix}${reason}`));
    }
    // Check if this is an object result with nested reasonsMap
    else if ('reasonsMap' in result) {
      for (const [field, fieldResult] of Object.entries(result.reasonsMap)) {
        const nestedPath = fieldPath ? `${fieldPath}.${field}` : field;
        errors.push(...extractValidationErrors(fieldResult, nestedPath));
      }
    }
  }

  return errors;
}

/********************************************************************************
 * Common Validator Functions
 ********************************************************************************/

/**
 * Creates a validator function that treats undefined values as valid and applies other validators otherwise.
 * This allows for optional fields in validation schemas where undefined values are acceptable.
 *
 * @param {...ValidatorFunction[]} validators - Variable number of validator functions to apply when value is not undefined
 * @returns {ValidatorFunction} A validator function that allows undefined values and validates defined values
 */
function optional(...validators: ValidatorFunction[]): ValidatorFunction {
  return (value: unknown): LeafValidatorResult => {
    if (value === undefined) {
      return VALID_RESULT;
    } else {
      return validateEach(validators, value);
    }
  };
}

function notSet(value: unknown): LeafValidatorResult {
  return value === undefined || value === null
    ? VALID_RESULT
    : { valid: false, reasons: ['Must not be set'] };
}

/**
 * Creates a validator function that treats null values as valid and applies other validators otherwise.
 * This allows for nullable fields in validation schemas where null values are acceptable.
 *
 * @param {...ValidatorFunction[]} validators - Variable number of validator functions to apply when value is not null
 * @returns {ValidatorFunction} A validator function that allows null values and validates non-null values
 */
function nullable(...validators: ValidatorFunction[]): ValidatorFunction {
  return (value: unknown): LeafValidatorResult => {
    if (value === null) {
      return VALID_RESULT;
    } else {
      return validateEach(validators, value);
    }
  };
}

/**
 * Validates whether a value is a string.
 *
 * @param {unknown} value - The value to be validated
 * @param {string} reason - Optional custom error message to display when validation fails
 * @returns {LeafValidatorResult} Object containing validation status and reason for failure if invalid
 */
function isString(value: unknown, reason: string = 'Must be a string'): LeafValidatorResult {
  return typeof value === 'string' ? VALID_RESULT : { valid: false, reasons: [reason] };
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

function fixedLength(len: number, reason?: string): ValidatorFunction {
  return length(len, len, reason);
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
  return (value: unknown): LeafValidatorResult => {
    if (value === null) {
      return { valid: false, reasons: [`Value is null`] };
    } else if (value === undefined) {
      return { valid: false, reasons: [`Value is undefined`] };
    }

    const valueIsString = typeof value === 'string';
    const valueIsArray = Array.isArray(value);
    const isTypeWithLength = valueIsString || valueIsArray;

    if (!isTypeWithLength) {
      return { valid: false, reasons: ['Value does not have a length'] };
    }

    if (value.length >= min && value.length <= max) {
      return VALID_RESULT;
    }
    const reasonText = () => {
      if (reason) {
        return reason;
      }

      let rangeText = `between ${min} and ${max}`;
      if (min === 0) {
        rangeText = `at most ${max}`;
      } else if (max === Infinity) {
        rangeText = `at least ${min}`;
      } else if (min === max) {
        rangeText = `exactly ${min}`;
      }

      const unitText = valueIsString ? 'characters' : 'selections';
      return `Must contain ${rangeText} ${unitText}`;
    };

    return {
      valid: false,
      reasons: [reasonText()],
    };
  };
}

/**
 * Creates a validator function that checks whether a value is in a set of allowed strings.
 *
 * @param {string[]} set
 * @param {string} [reason]
 */
function isInSet<T>(set: T[], reason?: string): ValidatorFunction {
  return (value: unknown): LeafValidatorResult => {
    return set.includes(value as T)
      ? VALID_RESULT
      : { valid: false, reasons: [reason ?? `Must be one of ${set.join(', ')}`] };
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
  return (value: unknown): LeafValidatorResult => {
    return typeof value === 'string' && regex.test(value)
      ? VALID_RESULT
      : { valid: false, reasons: [error ?? `Must match the pattern ${regex}`] };
  };
}

/**
 * Validates whether a value is a valid email address format.
 *
 * @param {unknown} value - The value to be validated as an email address
 * @returns {LeafValidatorResult} Object containing validation status and reason for failure if invalid
 */
function isEmailAddress(value: unknown): LeafValidatorResult {
  return matches(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Must be a valid email address')(value);
}

/**
 * Validates whether a value is a valid 10-digit phone number format.
 *
 * @param {unknown} value - The value to be validated as a phone number
 * @returns {LeafValidatorResult} Object containing validation status and reason for failure if invalid
 */
function isPhoneNumber(value: unknown): LeafValidatorResult {
  return matches(/^\d{10}$/, 'Must be a valid phone number')(value);
}

const V = {
  extractValidationErrors,
  fixedLength,
  isEmailAddress,
  isInSet,
  isPhoneNumber,
  isString,
  length,
  matches,
  maxLength,
  minLength,
  notSet,
  nullable,
  optional,
  validate,
  validateEach,
  validateKey,
  validateObject,
  VALID_RESULT,
};

export default V;
