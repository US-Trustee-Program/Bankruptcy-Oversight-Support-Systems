export type ValidatorResult = {
  valid?: true;
  reasons?: string[];
  reasonMap?: Record<string, ValidatorResult>;
};

export type ValidatorFunction = (value: unknown) => ValidatorResult;

export type ValidationSpec<T> = {
  [K in keyof T]?: T[K] extends object
    ? ValidatorFunction[] | ValidationSpec<T[K]>
    : ValidatorFunction[];
};

export const VALID: ValidatorResult = { valid: true } as const;

export interface Validator {
  validate(func: ValidatorFunction, value: unknown): ValidatorResult;
  validateEach(funcs: ValidatorFunction[], value: unknown): ValidatorResult;
  validateKey(spec: ValidationSpec<unknown>, key: string, obj: unknown): ValidatorResult;
  validateObject(spec: ValidationSpec<unknown>, obj: unknown): ValidatorResult;
  flattenReasonMap(
    reasonMap: Record<string, ValidatorResult>,
    prefix: string,
  ): Record<string, string[]>;
  flatten(reasonMap: Record<string, ValidatorResult>): string[];
}

export interface Validators {
  minLength(min: number, reason?: string): ValidatorFunction;
  maxLength(max: number, reason?: string): ValidatorFunction;
  spec(spec: ValidationSpec<unknown>): ValidatorFunction;
  notSet(value: unknown): ValidatorResult;
  skip(func: (value: unknown) => boolean, validators: ValidatorFunction[]): ValidatorFunction;
  nullable(validators: ValidatorFunction[]): ValidatorFunction;
  optional(validators: ValidatorFunction[]): ValidatorFunction;
  exactLength(length: number, reason?: string): ValidatorFunction;
  length(min: number, max: number, reason?: string): ValidatorFunction;
  isInSet<T>(set: T[], reason?: string): ValidatorFunction;
  matches(regex: RegExp, reason?: string): ValidatorFunction;
  isEmailAddress(value: unknown): ValidatorResult;
  isPhoneNumber(value: unknown): ValidatorResult;
}
