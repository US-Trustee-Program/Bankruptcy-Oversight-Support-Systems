import { useState, useCallback } from 'react';

export interface ValidationError {
  field: string;
  message: string;
}

export interface FormValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  fieldErrors: Record<string, string>;
}

export interface TrusteeFormData {
  name: string;
  address1: string;
  address2?: string;
  city: string;
  state: string;
  zipCode: string;
  phone?: string;
  extension?: string;
  email?: string;
  district?: string;
  chapters?: string[];
}

// Validation rules
const validateRequired = (value: string, fieldName: string): string | null => {
  if (!value || value.trim() === '') {
    return `${fieldName} is required`;
  }
  return null;
};

const validateZipCode = (value: string): string | null => {
  if (!value || value.trim() === '') {
    return 'ZIP code is required';
  }
  if (!/^\d{5}$/.test(value.trim())) {
    return 'ZIP code must be exactly 5 digits';
  }
  return null;
};

const validateEmail = (value: string): string | null => {
  if (!value || value.trim() === '') {
    return null; // Email is optional
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(value.trim())) {
    return 'Please enter a valid email address';
  }
  return null;
};

const validatePhone = (value: string): string | null => {
  if (!value || value.trim() === '') {
    return null; // Phone is optional
  }
  // Allow various phone formats: (123) 456-7890, 123-456-7890, 123.456.7890, 1234567890
  const phoneRegex =
    /^[()\s\-.]*\d[()\s\-.]*\d[()\s\-.]*\d[()\s\-.]*\d[()\s\-.]*\d[()\s\-.]*\d[()\s\-.]*\d[()\s\-.]*\d[()\s\-.]*\d[()\s\-.]*\d[()\s\-.]*$/;
  if (!phoneRegex.test(value.trim())) {
    return 'Please enter a valid phone number';
  }
  return null;
};

export function useTrusteeFormValidation() {
  const [errors, setErrors] = useState<ValidationError[]>([]);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const validateField = useCallback((field: string, value: string): string | null => {
    switch (field) {
      case 'name':
        return validateRequired(value, 'Trustee name');
      case 'address1':
        return validateRequired(value, 'Address line 1');
      case 'address2':
        return null; // Optional field, no validation needed
      case 'city':
        return validateRequired(value, 'City');
      case 'state':
        return validateRequired(value, 'State');
      case 'zipCode':
        return validateZipCode(value);
      case 'phone':
        return validatePhone(value);
      case 'extension':
        return null; // Optional field, no validation needed beyond basic format
      case 'email':
        return validateEmail(value);
      case 'district':
        return null; // Optional field, handled by selection component
      case 'chapters':
        return null; // Optional field, handled by selection component
      default:
        return null;
    }
  }, []);

  const validateForm = useCallback(
    (formData: TrusteeFormData): FormValidationResult => {
      const newErrors: ValidationError[] = [];
      const newFieldErrors: Record<string, string> = {};

      // Validate all fields, including optional ones that have values
      Object.entries(formData).forEach(([field, value]) => {
        // For array fields like chapters, convert to string for validation
        const stringValue = Array.isArray(value) ? value.join(',') : value || '';
        const error = validateField(field, stringValue);
        if (error) {
          newErrors.push({ field, message: error });
          newFieldErrors[field] = error;
        }
      });

      setErrors(newErrors);
      setFieldErrors(newFieldErrors);

      return {
        isValid: newErrors.length === 0,
        errors: newErrors,
        fieldErrors: newFieldErrors,
      };
    },
    [validateField],
  );

  const validateFieldAndUpdate = useCallback(
    (field: string, value: string): string | null => {
      const error = validateField(field, value);

      setFieldErrors((prev) => {
        const updated = { ...prev };
        if (error) {
          updated[field] = error;
        } else {
          delete updated[field];
        }
        return updated;
      });

      setErrors((prev) => {
        const filtered = prev.filter((e) => e.field !== field);
        if (error) {
          filtered.push({ field, message: error });
        }
        return filtered;
      });

      return error;
    },
    [validateField],
  );

  const clearErrors = useCallback(() => {
    setErrors([]);
    setFieldErrors({});
  }, []);

  const clearFieldError = useCallback((field: string) => {
    setFieldErrors((prev) => {
      const updated = { ...prev };
      delete updated[field];
      return updated;
    });
    setErrors((prev) => prev.filter((e) => e.field !== field));
  }, []);

  return {
    errors,
    fieldErrors,
    validateForm,
    validateFieldAndUpdate,
    clearErrors,
    clearFieldError,
  };
}
