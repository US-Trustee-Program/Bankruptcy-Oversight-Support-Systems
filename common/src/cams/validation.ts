/********************************************************************************
 * Core Validation Library Types and Functions
 ********************************************************************************/
export type ValidatorReason = { reason: string; key?: string };
export type ValidValidatorResult = { valid: true };
// export type InvalidValidatorResult = { valid: false; reasons: string[] };
export type InvalidValidatorResult<T = unknown> = { valid: false } & ValidatorReason;

// Option 0.5
// Recursively _assemble_ a list of validator function.
// Execute each function
// result if invalid is a list of results {'key': 'keyName', 'reason': 'error message'}

export type ValidatorResult = ValidValidatorResult | InvalidValidatorResult;
export type ValidatorResultSet =
  | ValidValidatorResult
  | { valid: false; reasonsMap: Record<string, ValidatorResult> };

export type ValidatorFunction = (value: unknown) => ValidatorResult | ValidatorResultSet;

// Type for nested validation specs - allows for recursive object validation
export type ValidationSpec<T> = {
  [K in keyof T]?: T[K] extends object
    ? ValidatorFunction[] | ValidationSpec<T[K]>
    : ValidatorFunction[];
};

const VALID_RESULT: ValidValidatorResult = { valid: true } as const;

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
function validateEach(functions: ValidatorFunction[], value: unknown): ValidatorResult {
  if (!functions) {
    return VALID_RESULT;
  }
  const reasons = functions
    .map((f) => f(value))
    .filter((r) => !r.valid)
    .map((r) => (r as InvalidValidatorResult).reasons)
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
 * @returns ValidatorResults an object containing validation status and reasons for failure
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
    const nestedResult = validateObject(rule as ValidationSpec<unknown>, obj[key]);
    // TODO: strongly consider removing this. I think we want validation to not roll up reasons and leave that to helper
    // functions run after the fact.
    if (nestedResult.valid) {
      return VALID_RESULT;
    } else {
      // Convert nested validation results to a flat list of reasons
      // TODO unsure about this approach?
      const reasons: string[] = [];
      const reasonsMap = (
        nestedResult as { valid: false; reasonsMap: Partial<Record<string, ValidatorResult>> }
      ).reasonsMap;
      for (const field in reasonsMap) {
        const fieldResult = reasonsMap[field];
        if (fieldResult && !fieldResult.valid) {
          reasons.push(
            `${String(field)}: ${(fieldResult as InvalidValidatorResult).reasons.join(', ')}`,
          );
        }
      }
      return { valid: false, reasons };
    }
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
function validateObject(spec: ValidationSpec<unknown>, obj: unknown): ValidatorResultSet<T> {
  const reasonsMap = (Object.keys(spec) as (keyof T)[]).reduce(
    (acc, key) => {
      const rule = spec[key];
      if (!rule) {
        return acc;
      }

      let results: ValidatorResult[] | ValidatorResultSet<T>;

      // Check if rule is an array of validator functions
      if (Array.isArray(rule)) {
        result = validateEach(rule, obj[key]);
      } else {
        // rule is a nested ValidationSpec
        result = validateObject(rule as ValidationSpec<unknown>, obj[key]);
      }

      if (!result.valid) {
        acc[key] = result;
      }
      return acc;
    },
    {} as Partial<Record<keyof T, ValidatorResult>>,
  );

  return Object.keys(reasonsMap).length > 0 ? { valid: false, reasonsMap } : VALID_RESULT;
}

/********************************************************************************
 * Common Validator Functions
 ********************************************************************************/

// TODO: Need to support dates, numbers.

function spec2funcs(spec: ValidationSpec<unknown>): ValidatorFunction {
  return (value: unknown)ValidatorResultSet => {
    Object.keys(v)
    // here we gather the validator functions. then execute.
  }
}



function spec(s: ValidationSpec<unknown>): ValidatorFunction {
  return (obj: unknown): ValidatorResultSet => {
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
      return VALID_RESULT;
    } else {
      return validateEach(validators, value);
    }
  };
}

function notSet(value: unknown): ValidatorResult {
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
  return (value: unknown): ValidatorResult => {
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
 * @returns {ValidatorResult} Object containing validation status and reason for failure if invalid
 */
function isString(value: unknown, reason: string = 'Must be a string'): ValidatorResult {
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
  return (value: unknown): ValidatorResult => {
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
  return (value: unknown): ValidatorResult => {
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
  return (value: unknown): ValidatorResult => {
    return typeof value === 'string' && regex.test(value)
      ? VALID_RESULT
      : { valid: false, reasons: [error ?? `Must match the pattern ${regex}`] };
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
  spec,
  optional,
  validate,
  validateEach,
  validateKey,
  validateObject,
  VALID_RESULT,
};

export default V;
