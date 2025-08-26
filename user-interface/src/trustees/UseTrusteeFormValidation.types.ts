import { ChapterType } from '@common/cams/parties';

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
  districts?: string[];
  chapters?: ChapterType[];
}

export interface ValidationError {
  field: string;
  message: string;
}

export interface TrusteeFormValidation {
  fieldErrors: Record<string, string>;
  errors: ValidationError[];
  validateFieldAndUpdate: (field: string, value: string) => string | null;
  clearErrors: () => void;
  clearFieldError: (field: string) => void;
  areRequiredFieldsFilled: (formData: TrusteeFormData) => boolean;
  isFormValidAndComplete: (formData: TrusteeFormData) => boolean;
}
