/**
 * Normalizes form data by trimming string values and converting empty strings to undefined.
 *
 * This utility function processes form data to ensure consistent handling of string fields:
 * - Trims whitespace from all string values
 * - Converts empty strings (after trimming) to undefined
 * - Preserves non-string values as-is
 *
 * @template T - The form data type (must be a record with string keys)
 * @param formData - The form data object to normalize
 * @returns A new form data object with normalized string values
 *
 * @example
 * const formData = { name: '  John  ', email: '', age: 30 };
 * const normalized = normalizeFormData(formData);
 * // Result: { name: 'John', email: undefined, age: 30 }
 */
export function normalizeFormData<T extends Record<string, unknown>>(formData: T): T {
  return Object.fromEntries(
    Object.entries(formData).map(([key, value]) => [
      key,
      typeof value === 'string' ? value.trim() || undefined : value,
    ]),
  ) as T;
}
