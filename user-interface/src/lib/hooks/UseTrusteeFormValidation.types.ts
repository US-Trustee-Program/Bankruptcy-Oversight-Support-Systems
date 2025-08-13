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

export interface ValidationError {
  field: string;
  message: string;
}

export interface FormValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  fieldErrors: Record<string, string>;
}

export interface TrusteeFormValidation {
  fieldErrors: Record<string, string>;
  errors: ValidationError[];
  validateForm: (formData: TrusteeFormData) => FormValidationResult;
  validateFieldAndUpdate: (field: string, value: string) => string | null;
  clearErrors: () => void;
  clearFieldError: (field: string) => void;
}
