import { useState } from 'react';
import {
  TrusteeFormData,
  ValidationError,
  FormValidationResult,
  TrusteeFormValidation,
} from './UseTrusteeFormValidation.types';

/**
 * Validates individual form fields with specific business rules
 */
function validateField(field: string, value: string): string | null {
  const trimmedValue = value.trim();

  switch (field) {
    case 'name':
      return !trimmedValue ? 'Trustee name is required' : null;

    case 'address1':
      return !trimmedValue ? 'Address line 1 is required' : null;

    case 'city':
      return !trimmedValue ? 'City is required' : null;

    case 'state':
      return !trimmedValue ? 'State is required' : null;

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
   * Validates entire form and returns comprehensive validation result
   */
  const validateForm = (formData: TrusteeFormData): FormValidationResult => {
    const errors: ValidationError[] = [];
    const newFieldErrors: Record<string, string> = {};

    // Validate each field
    Object.entries(formData).forEach(([field, value]) => {
      const error = validateField(field, value);
      if (error) {
        errors.push({ field, message: error });
        newFieldErrors[field] = error;
      }
    });

    // Update field errors state
    setFieldErrors(newFieldErrors);

    return {
      isValid: errors.length === 0,
      errors,
      fieldErrors: newFieldErrors,
    };
  };

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

  return {
    fieldErrors,
    errors: Object.entries(fieldErrors).map(([field, message]) => ({ field, message })),
    validateForm,
    validateFieldAndUpdate,
    clearErrors,
    clearFieldError,
  };
}

export default useTrusteeFormValidation;
