import { useState } from 'react';
import { TrusteeFormData, TrusteeFormValidation } from './UseTrusteeFormValidation.types';

/**
 * Validates individual form fields with specific business rules
 */
function validateField(field: string, value: string | string[] | undefined | null): string | null {
  // Handle undefined/null values safely
  if (value == null) {
    return null; // Skip validation for optional fields that are null/undefined
  }

  // Handle array fields (like chapters)
  if (Array.isArray(value)) {
    // For now, we don't validate array fields in this function
    return null;
  }

  // Convert to string and trim
  const stringValue = String(value);
  const trimmedValue = stringValue.trim();

  switch (field) {
    case 'name':
      return trimmedValue ? null : 'Trustee name is required';

    case 'address1':
      return trimmedValue ? null : 'Address line 1 is required';

    case 'city':
      return trimmedValue ? null : 'City is required';

    case 'state':
      return trimmedValue ? null : 'State is required';

    case 'zipCode':
      if (!trimmedValue) {
        return 'ZIP code is required';
      }
      // ZIP code must be exactly 5 digits
      if (!/^\d{5}$/.test(trimmedValue)) {
        return 'ZIP code must be exactly 5 digits';
      }
      return null;

    default:
      return null;
  }
}

/**
 * Custom hook for managing trustee form validation
 */
export function useTrusteeFormValidation(): TrusteeFormValidation {
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  /**
   * Validates a single field and updates the field errors state
   */
  const validateFieldAndUpdate = (field: string, value: string): string | null => {
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
    const requiredFields = ['name', 'address1', 'city', 'state', 'zipCode'];
    return requiredFields.every((field) => {
      const value = formData[field as keyof TrusteeFormData];
      return value && typeof value === 'string' && value.trim() !== '';
    });
  };

  /**
   * Checks if form is both valid (no errors) and complete (all required fields filled)
   */
  const isFormValidAndComplete = (formData: TrusteeFormData): boolean => {
    // First check if all required fields are filled
    if (!areRequiredFieldsFilled(formData)) {
      return false;
    }

    Object.entries(formData).forEach(([field, value]) => {
      if (value !== undefined) {
        const error = validateField(field, value);
        if (error) {
          return false;
        }
      }
    });

    return true; // All required fields filled and no validation errors
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
