import { validateObject } from '@common/cams/validation';
import {
  phoneExtension,
  phoneNumber,
  typedPhoneNumberSpec,
} from '@common/cams/trustees-validators';
import { TypedPhoneNumber } from '@common/cams/trustees';
import { FIELD_VALIDATION_MESSAGES } from '@common/cams/validation-messages';
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
 * Validates the flag-disabled fallback UI's direct phone/extension fields. These aren't
 * real form-data keys (the model only carries `phones`), so this validates the 'direct'
 * entry of a phones array directly rather than going through a form's ValidationSpec.
 */
export function validateDirectPhoneFields(phones: TypedPhoneNumber[]): {
  phone?: string[];
  extension?: string[];
} {
  const direct = phones.find((p) => p.type === 'direct') ?? { number: '', type: 'direct' as const };
  const errors: { phone?: string[]; extension?: string[] } = {};

  if (direct.number) {
    const result = phoneNumber(direct.number);
    if (!result.valid) {
      errors.phone = result.reasons;
    }
  }

  const extensionResult = phoneExtension(direct.extension);
  if (!extensionResult.valid) {
    errors.extension = extensionResult.reasons;
  }

  if (direct.extension && !direct.number) {
    errors.phone = [
      ...(errors.phone ?? []),
      FIELD_VALIDATION_MESSAGES.PHONE_REQUIRED_WITH_EXTENSION,
    ];
  }

  return errors;
}

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
