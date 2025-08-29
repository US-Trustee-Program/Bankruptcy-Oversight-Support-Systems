type ValidatorResult = { valid: true } | { valid: false; reason: string };
export type ValidatorFunction = (value: unknown) => ValidatorResult;
export type ValidationSpec<T> = Record<keyof T, ValidatorFunction[]>;

// Need to support dates, numbers. Nullable and undefined.
// Required vs optional.

function isString(value: unknown): ValidatorResult {
  return typeof value === 'string' ? { valid: true } : { valid: false, reason: 'Must be a string' };
}

function minLength(length: number): ValidatorFunction {
  return (value: unknown): ValidatorResult => {
    return typeof value === 'string' && value.length >= length
      ? { valid: true }
      : { valid: false, reason: `Must be at least ${length} characters long` };
  };
}

function maxLength(length: number): ValidatorFunction {
  return (value: unknown): ValidatorResult => {
    return typeof value === 'string' && value.length <= length
      ? { valid: true }
      : { valid: false, reason: `Must be no more than ${length} characters long` };
  };
}

function length(min: number, max: number, reason?: string): ValidatorFunction {
  return (value: unknown): ValidatorResult => {
    if (Array.isArray(value)) {
      return value.length >= min && value.length <= max
        ? { valid: true }
        : {
            valid: false,
            reason: reason ?? `List must contain between ${min} and ${max} elements`,
          };
    } else if (typeof value === 'string') {
      return value.length >= min && value.length <= max
        ? { valid: true }
        : { valid: false, reason: reason ?? `Must be between ${min} and ${max} characters long` };
    } else {
      return { valid: false, reason: reason ?? 'Type does not have a length' };
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

function validate(func: ValidatorFunction, value: unknown): ValidatorResult {
  return func(value);
}

type ValidatorResults = { valid: true } | { valid: false; reasons: string[] };

function validateEach(functions: ValidatorFunction[], value: unknown): ValidatorResults {
  const results: ValidatorResult[] = [];
  for (const func of functions) {
    results.push(func(value));
  }
  return results.reduce(
    (acc: ValidatorResults, result: ValidatorResult) => {
      acc.valid = acc.valid && result.valid;
      if (!result.valid) {
        acc.valid = false;
        if (acc['reasons']) {
          acc['reasons'].push(result['reason']);
        } else {
          acc['reasons'] = [result['reason']];
        }
      }
      return acc;
    },
    { valid: true },
  );
}

function validateKey<T>(spec: ValidationSpec<T>, key: keyof T, obj: T): ValidatorResults {
  return validateEach(spec[key], obj[key]);
}

function validateObject<T>(
  spec: ValidationSpec<T>,
  obj: T,
): { valid: true } | { valid: false; reasons: Record<keyof T, ValidatorResults> } {
  return Object.keys(spec).reduce(
    (acc, key) => {
      const result = validateKey(spec, key as keyof T, obj);
      if (!result.valid) {
        // @ts-expect-error - TS doesn't know that `valid` is now `false` so the `true` type is no longer the valid type.'
        acc.valid = false;
        if (acc['reasons']) {
          acc['reasons'][key] = result;
        } else {
          acc['reasons'] = { [key]: result };
        }
      }
      return acc;
    },
    { valid: true },
  );
}

const V = {
  isString,
  minLength,
  maxLength,
  length,
  matches,
  isEmailAddress,
  isPhoneNumber,
  validateObject,
  validateKey,
  validateEach,
  validate,
  isInSet,
};

export default V;
