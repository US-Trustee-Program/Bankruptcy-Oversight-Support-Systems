/********************************************************************************
 * Simple Validation Library
 ********************************************************************************/

// Core types
export type ValidationResult = {
  valid: boolean;
  error?: string;
};

export type FieldValidationResult = {
  [field: string]: string | undefined; // field name -> error message (undefined if valid)
};

export type ValidatorFunction = (value: unknown) => ValidationResult;

// Validation spec for objects
export type ValidationSpec = {
  [field: string]: ValidatorFunction[];
};

// Constants
const VALID: ValidationResult = { valid: true } as const;

/********************************************************************************
 * Core Validation Functions
 ********************************************************************************/

/**
 * Runs a single validator function against a value
 */
function validate(validator: ValidatorFunction, value: unknown): ValidationResult {
  return validator(value);
}

/**
 * Runs multiple validators against a single value.
 * Returns the first error encountered, or valid if all pass.
 */
function validateValue(validators: ValidatorFunction[], value: unknown): ValidationResult {
  for (const validator of validators) {
    const result = validator(value);
    if (!result.valid) {
      return result;
    }
  }
  return VALID;
}

/**
 * Validates an object against a validation spec.
 * Returns field-level errors for any invalid fields.
 */
function validateObject(spec: ValidationSpec, obj: Record<string, unknown>): FieldValidationResult {
  const errors: FieldValidationResult = {};

  for (const fieldName in spec) {
    const validators = spec[fieldName];
    if (!validators) {
      continue;
    }

    const value = obj[fieldName];
    const result = validateValue(validators, value);

    if (!result.valid) {
      errors[fieldName as string] = result.error;
    }
  }

  return errors;
}

/**
 * Validates a single field of an object.
 * Useful for real-time validation as user types.
 */
function validateField(spec: ValidationSpec, fieldName: string, value: unknown): ValidationResult {
  const validators = spec[fieldName];
  if (!validators) {
    return VALID;
  }
  return validateValue(validators, value);
}

/**
 * Checks if validation results contain any errors
 */
function hasErrors(results: FieldValidationResult): boolean {
  return Object.values(results).some((error) => error !== undefined);
}

/**
 * Gets all error messages from validation results as an array
 */
function getErrors(results: FieldValidationResult): string[] {
  return Object.values(results).filter((error): error is string => error !== undefined);
}

/********************************************************************************
 * Validator Functions
 ********************************************************************************/

/**
 * Validates that a value is required (not undefined, null, or empty string)
 */
function required(message: string = 'This field is required'): ValidatorFunction {
  return (value: unknown): ValidationResult => {
    if (value === undefined || value === null || value === '') {
      return { valid: false, error: message };
    }
    return VALID;
  };
}

/**
 * Validates that a value is a string
 */
function isString(message: string = 'Must be a string'): ValidatorFunction {
  return (value: unknown): ValidationResult => {
    if (typeof value !== 'string') {
      return { valid: false, error: message };
    }
    return VALID;
  };
}

/**
 * Validates minimum length for strings and arrays
 */
function minLength(min: number, message?: string): ValidatorFunction {
  return (value: unknown): ValidationResult => {
    if (value === null || value === undefined) {
      return { valid: false, error: message || `Must have at least ${min} characters` };
    }

    const hasLength = typeof value === 'string' || Array.isArray(value);
    if (!hasLength) {
      return { valid: false, error: 'Value must have a length property' };
    }

    if (value.length < min) {
      const unit = typeof value === 'string' ? 'characters' : 'items';
      return { valid: false, error: message || `Must have at least ${min} ${unit}` };
    }

    return VALID;
  };
}

/**
 * Validates maximum length for strings and arrays
 */
function maxLength(max: number, message?: string): ValidatorFunction {
  return (value: unknown): ValidationResult => {
    const hasLength = typeof value === 'string' || Array.isArray(value);
    if (!hasLength) {
      return { valid: false, error: 'Value must have a length property' };
    }

    if (value.length > max) {
      const unit = typeof value === 'string' ? 'characters' : 'items';
      return { valid: false, error: message || `Must have at most ${max} ${unit}` };
    }

    return VALID;
  };
}

/**
 * Validates exact length for strings and arrays
 */
function exactLength(length: number, message?: string): ValidatorFunction {
  return (value: unknown): ValidationResult => {
    const hasLength = typeof value === 'string' || Array.isArray(value);
    if (!hasLength) {
      return { valid: false, error: 'Value must have a length property' };
    }

    if (value.length !== length) {
      const unit = typeof value === 'string' ? 'characters' : 'items';
      return { valid: false, error: message || `Must have exactly ${length} ${unit}` };
    }

    return VALID;
  };
}

/**
 * Validates that a string matches a regular expression
 */
function matches(regex: RegExp, message?: string): ValidatorFunction {
  return (value: unknown): ValidationResult => {
    if (typeof value !== 'string') {
      return { valid: false, error: 'Value must be a string' };
    }

    if (!regex.test(value)) {
      return { valid: false, error: message || `Must match pattern ${regex}` };
    }

    return VALID;
  };
}

/**
 * Validates that a value is one of the allowed options
 */
function oneOf(options: unknown[], message?: string): ValidatorFunction {
  return (value: unknown): ValidationResult => {
    if (!options.includes(value)) {
      return {
        valid: false,
        error: message || `Must be one of: ${options.join(', ')}`,
      };
    }
    return VALID;
  };
}

/**
 * Makes a validator optional - passes if value is undefined, otherwise applies validators
 */
function optional(...validators: ValidatorFunction[]): ValidatorFunction {
  return (value: unknown): ValidationResult => {
    if (value === undefined) {
      return VALID;
    }
    return validateValue(validators, value);
  };
}

/**
 * Makes a validator nullable - passes if value is null, otherwise applies validators
 */
function nullable(...validators: ValidatorFunction[]): ValidatorFunction {
  return (value: unknown): ValidationResult => {
    if (value === null) {
      return VALID;
    }
    return validateValue(validators, value);
  };
}

/********************************************************************************
 * Common Validation Patterns
 ********************************************************************************/

/**
 * Email validation
 */
function email(message: string = 'Must be a valid email address'): ValidatorFunction {
  return matches(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, message);
}

/**
 * Phone number validation (10 digits)
 */
function phoneNumber(message: string = 'Must be a valid 10-digit phone number'): ValidatorFunction {
  return matches(/^\d{10}$/, message);
}

/**
 * US ZIP code validation (5 digits or 5+4 format)
 */
function zipCode(message: string = 'Must be a valid ZIP code'): ValidatorFunction {
  return matches(/^\d{5}(-\d{4})?$/, message);
}

/********************************************************************************
 * Export API
 ********************************************************************************/

export const V = {
  // Core functions
  validate,
  validateValue,
  validateObject,
  validateField,
  hasErrors,
  getErrors,

  // Basic validators
  required,
  isString,
  minLength,
  maxLength,
  exactLength,
  matches,
  oneOf,
  optional,
  nullable,

  // Common patterns
  email,
  phoneNumber,
  zipCode,

  // Constant
  VALID,
};

export default V;
