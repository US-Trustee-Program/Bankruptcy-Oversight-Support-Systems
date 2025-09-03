import { useState } from 'react';
import { TrusteeFormData, TrusteeFormValidation } from './UseTrusteeFormValidation.types';
import { TRUSTEE_STATUS_VALUES, TrusteeStatus } from '@common/cams/parties';
import { EMAIL_REGEX, PHONE_REGEX, EXTENSION_REGEX, ZIP_REGEX } from '@common/cams/regex';
import V, { ValidationSpec } from '@common/cams/validation';

const trusteeFormDataSpec: ValidationSpec<TrusteeFormData> = {
  name: [V.minLength(1, 'Trustee name is required')],
  address1: [V.minLength(1, 'Address is required')],
  address2: [V.optional(V.maxLength(50))],
  city: [V.minLength(1, 'City is required')],
  state: [V.fixedLength(2, 'State is required')],
  zipCode: [V.matches(ZIP_REGEX, 'ZIP code must be 5 digits or 9 digits with a hyphen')],
  email: [V.matches(EMAIL_REGEX, 'Email must be a valid email address')],
  phone: [V.matches(PHONE_REGEX, 'Phone is required')],
  extension: [V.optional(V.matches(EXTENSION_REGEX, 'Extension must be 1 to 6 digits'))],
  status: [V.isInSet<TrusteeStatus>([...TRUSTEE_STATUS_VALUES])],
};

/**
 * Validates individual form fields with specific business rules
 */
function validateField(field: keyof TrusteeFormData, value: string): string | null {
  // Convert to string and trim
  const stringValue = String(value);
  const trimmedValue = stringValue.trim();

  if (field === 'status' || (field === 'extension' && !trimmedValue)) {
    return null;
  }

  const result = V.validateEach(trusteeFormDataSpec[field]!, trimmedValue);
  return result.valid ? null : result.reasons.join('. ');
}

/**
 * Custom hook for managing trustee form validation
 */
export function useTrusteeFormValidation(): TrusteeFormValidation {
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  /**
   * Validates a single field and updates the field errors state
   */
  const validateFieldAndUpdate = (field: keyof TrusteeFormData, value: string): string | null => {
    const error = validateField(field, value);

    setFieldErrors((prevErrors) => {
      if (error) {
        return { ...prevErrors, [field]: error };
      } else {
        const { [field]: _, ...rest } = prevErrors;
        return rest;
      }
    });

    return error;
  };

  /**
   * Clears all validation errors
   */
  const clearErrors = (): void => {
    setFieldErrors({});
  };

  /**
   * Clears validation error for a specific field
   */
  const clearFieldError = (field: string): void => {
    setFieldErrors((prevErrors) => {
      const { [field]: _, ...rest } = prevErrors;
      return rest;
    });
  };

  /**
   * Checks if all required fields are filled
   */
  const areRequiredFieldsFilled = (formData: TrusteeFormData): boolean => {
    const requiredFields = ['name', 'address1', 'city', 'state', 'zipCode', 'phone', 'email'];
    return requiredFields.every((field) => {
      const value = formData[field as keyof TrusteeFormData];
      return value && typeof value === 'string' && value.trim() !== '';
    });
  };

  /**
   * Checks if form is both valid (no errors) and complete (all required fields filled)
   */
  const isFormValidAndComplete = (formData: TrusteeFormData): boolean => {
    const result = V.validateObject<TrusteeFormData>(trusteeFormDataSpec, formData);
    return result.valid;
  };

  return {
    fieldErrors,
    errors: Object.entries(fieldErrors).map(([field, message]) => ({ field, message })),
    validateFieldAndUpdate,
    clearErrors,
    clearFieldError,
    areRequiredFieldsFilled,
    isFormValidAndComplete,
  };
}

export default useTrusteeFormValidation;
