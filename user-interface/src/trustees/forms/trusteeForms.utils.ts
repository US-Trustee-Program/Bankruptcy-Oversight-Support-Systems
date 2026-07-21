import { validateObject } from '@common/cams/validation';
import { typedPhoneNumberSpec } from '@common/cams/trustees-validators';
import { TypedPhoneNumber } from '@common/cams/trustees';
import { PhoneRowErrors } from '@/lib/components/cams/TypedPhoneList/TypedPhoneList';

/**
 * Mapped type that represents normalized form data where string fields may become undefined.
 */
type NormalizedFormData<T> = {
  [K in keyof T]: T[K] extends string ? string | undefined : T[K];
};

/**
 * Normalizes form data by trimming string values and converting empty strings to undefined.
 *
 * This utility function processes form data to ensure consistent handling of string fields:
 * - Trims whitespace from all string values
 * - Converts empty strings (after trimming) to undefined
 * - Preserves non-string values as-is
 * - Optionally excludes specific fields from normalization (for IDs, codes, etc. where spaces matter)
 *
 * @template T - The form data type (must be a record with string keys)
 * @param formData - The form data object to normalize
 * @param excludeFields - Optional array of field names to skip normalization
 * @returns A new form data object with normalized string values (string fields typed as string | undefined)
 *
 * @example
 * const formData = { name: '  John  ', email: '', age: 30 };
 * const normalized = normalizeFormData(formData);
 * // Result: { name: 'John', email: undefined, age: 30 }
 *
 * @example
 * // Exclude specific fields from normalization
 * const formData = { name: '  John  ', code: '  ABC  ' };
 * const normalized = normalizeFormData(formData, ['code']);
 * // Result: { name: 'John', code: '  ABC  ' }
 */
export function normalizeFormData<T extends Record<string, unknown>>(
  formData: T,
  excludeFields?: (keyof T)[],
): NormalizedFormData<T> {
  return Object.fromEntries(
    Object.entries(formData).map(([key, value]) => {
      if (excludeFields?.includes(key as keyof T)) {
        return [key, value];
      }
      return [key, typeof value === 'string' ? value.trim() || undefined : value];
    }),
  ) as NormalizedFormData<T>;
}

/**
 * Validates each phone in a fixed one-row-per-type TypedPhoneList array, skipping rows
 * the user hasn't touched (both number and extension still blank) so an untouched Cell
 * or Home row doesn't show a "must be a valid phone number" error before it's ever used.
 */
export function validateTypedPhones(phones: TypedPhoneNumber[]): Record<number, PhoneRowErrors> {
  const errors: Record<number, PhoneRowErrors> = {};

  phones.forEach((phone, index) => {
    const touched = !!phone.number.trim() || !!phone.extension?.trim();
    if (!touched) {
      return;
    }

    const result = validateObject(typedPhoneNumberSpec, phone);
    if (result.valid || !result.reasonMap) {
      return;
    }

    const rowErrors: PhoneRowErrors = {};
    if (result.reasonMap.number?.reasons) {
      rowErrors.number = result.reasonMap.number.reasons;
    }
    if (result.reasonMap.extension?.reasons) {
      rowErrors.extension = result.reasonMap.extension.reasons;
    }
    if (Object.keys(rowErrors).length > 0) {
      errors[index] = rowErrors;
    }
  });

  return errors;
}
