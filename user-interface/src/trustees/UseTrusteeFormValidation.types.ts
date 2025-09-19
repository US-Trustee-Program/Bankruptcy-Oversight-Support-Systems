import { ChapterType, TrusteeStatus } from '@common/cams/trustees';
import { trusteeFormDataSpec } from './UseTrusteeFormValidation';

export interface TrusteeFormData {
  name: string;
  address1: string;
  address2?: string;
  city: string;
  state: string;
  zipCode: string;
  phone: string;
  extension?: string;
  email: string;
  districts?: string[];
  chapters?: ChapterType[];
  status: TrusteeStatus;
}

export interface ValidationError {
  field: string;
  message: string;
}

export interface TrusteeFormValidation {
  fieldErrors: Record<string, string>;
  errors: ValidationError[];
  validateFieldAndUpdate: (
    field: keyof TrusteeFormData,
    value: string,
    spec: Partial<typeof trusteeFormDataSpec>,
  ) => string | null;
  clearErrors: () => void;
  clearFieldError: (field: string) => void;
  isFormValidAndComplete: (
    formData: TrusteeFormData,
    spec: Partial<typeof trusteeFormDataSpec>,
  ) => boolean;
}
