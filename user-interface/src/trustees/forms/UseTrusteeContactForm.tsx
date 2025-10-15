import { useState } from 'react';
import { ContactInformation } from '@common/cams/contact';
import {
  ChapterType,
  TRUSTEE_STATUS_VALUES,
  TrusteeInput,
  TrusteeStatus,
} from '@common/cams/trustees';
import {
  flattenReasonMap,
  validateEach,
  validateObject,
  ValidationSpec,
} from '@common/cams/validation';
import V from '@common/cams/validators';
import {
  EMAIL_REGEX,
  EXTENSION_REGEX,
  PHONE_REGEX,
  WEBSITE_RELAXED_REGEX,
  ZIP_REGEX,
} from '@common/cams/regex';

export const TRUSTEE_SPEC: Readonly<ValidationSpec<TrusteeFormData>> = {
  name: [V.minLength(1, 'Trustee name is required'), V.maxLength(50)],
  address1: [V.minLength(1, 'Address is required'), V.maxLength(40)],
  address2: [V.optional(V.maxLength(40))],
  city: [V.minLength(1, 'City is required'), V.maxLength(50)],
  state: [V.exactLength(2, 'State is required')],
  zipCode: [V.matches(ZIP_REGEX, 'ZIP code must be 5 digits or 9 digits with a hyphen')],
  email: [V.matches(EMAIL_REGEX, 'Email must be a valid email address'), V.maxLength(50)],
  website: [
    V.optional(V.matches(WEBSITE_RELAXED_REGEX, 'Website must be a valid URL'), V.maxLength(255)),
  ],
  phone: [V.matches(PHONE_REGEX, 'Phone must be a valid phone number')],
  extension: [V.optional(V.matches(EXTENSION_REGEX, 'Extension must be 1 to 6 digits'))],
  status: [V.isInSet<TrusteeStatus>([...TRUSTEE_STATUS_VALUES])],
};

export interface TrusteeFormData {
  name?: string;
  address1?: string;
  address2?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  phone?: string;
  extension?: string;
  email?: string;
  website?: string;
  districts?: string[];
  chapters?: ChapterType[];
  status?: TrusteeStatus;
}

export type TrusteeFormState = {
  action: 'create' | 'edit';
  cancelTo: string;
  trusteeId?: string;
  trustee?: Partial<TrusteeInput>;
  contactInformation?: 'internal' | 'public';
};

type UseTrusteeFormProps = {
  initialState: TrusteeFormState;
};

/**
 * Validates individual form fields with specific business rules
 */
function validateField(
  field: keyof TrusteeFormData,
  value: string,
  spec: Partial<typeof TRUSTEE_SPEC>,
): string | null {
  // Convert to string and trim
  const stringValue = String(value);
  const trimmedValue = stringValue.trim();

  if (
    field === 'status' ||
    (field === 'extension' && !trimmedValue) ||
    (field === 'website' && !trimmedValue)
  ) {
    return null;
  }

  if (spec?.[field]) {
    const result = validateEach(spec[field], trimmedValue);
    return result.valid ? null : result.reasons!.join(' ');
  } else {
    return null;
  }
}

export function useTrusteeContactForm({ initialState }: UseTrusteeFormProps) {
  const doEditInternalProfile =
    initialState.action === 'edit' && initialState.contactInformation === 'internal';
  const doEditPublicProfile =
    initialState.action === 'edit' && initialState.contactInformation === 'public';

  const getInitialFormData = (): TrusteeFormData => {
    let info: Partial<ContactInformation> | undefined;

    if (doEditInternalProfile && initialState.trustee?.internal) {
      info = initialState.trustee.internal;
    } else if (doEditPublicProfile && initialState.trustee?.public) {
      info = initialState.trustee.public;
    }

    return {
      name: initialState.trustee?.name,
      address1: info?.address?.address1,
      address2: info?.address?.address2,
      city: info?.address?.city,
      state: info?.address?.state,
      zipCode: info?.address?.zipCode,
      phone: info?.phone?.number,
      extension: info?.phone?.extension,
      email: info?.email,
      website: info?.website,
      districts: initialState.trustee?.districts ?? undefined,
      chapters: initialState.trustee?.chapters ?? undefined,
      status: initialState.trustee?.status ?? 'active',
    };
  };

  const [formData, setFormData] = useState<TrusteeFormData>(getInitialFormData());
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const updateField = (field: keyof TrusteeFormData, value: unknown) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const updateMultipleFields = (fields: Partial<TrusteeFormData>) => {
    setFormData((prev) => ({ ...prev, ...fields }));
  };

  const resetForm = () => {
    setFormData(getInitialFormData());
  };

  const getFormData = (override?: { name: keyof TrusteeFormData; value: string }) => {
    const trimmedData = {
      ...formData,
      name: formData.name?.trim(),
      address1: formData.address1?.trim(),
      address2: formData.address2?.trim(),
      city: formData.city?.trim(),
      zipCode: formData.zipCode?.trim(),
      phone: formData.phone?.trim(),
      extension: formData.extension?.trim(),
      email: formData.email?.trim(),
      website: formData.website?.trim(),
      districts: formData.districts,
      chapters: formData.chapters,
      status: formData.status,
    };

    Object.keys(trimmedData).forEach((key) => {
      if (trimmedData[key as keyof TrusteeFormData] === '') {
        trimmedData[key as keyof TrusteeFormData] = undefined;
      }
    });

    if (override) {
      return { ...trimmedData, [override.name]: override.value } as TrusteeFormData;
    }
    return trimmedData;
  };

  /**
   * Validates a single field and updates the field errors state
   */
  const validateFieldAndUpdate = (
    field: keyof TrusteeFormData,
    value: string,
    spec: Partial<typeof TRUSTEE_SPEC>,
  ): string | null => {
    const error = validateField(field, value, spec);

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
   * Checks if form is both valid (no errors) and complete (all required fields filled)
   */
  const validateFormAndUpdateErrors = (
    formData: TrusteeFormData,
    spec: Partial<typeof TRUSTEE_SPEC>,
  ): boolean => {
    const results = validateObject(spec, formData);
    if (!results.valid && results.reasonMap) {
      const newFieldErrors = Object.fromEntries(
        Object.entries(flattenReasonMap(results.reasonMap)).map(([jsonPath, reasons]) => {
          const field = jsonPath.split('.')[1];
          return [field, reasons.join('. ') + '.'];
        }),
      );
      setFieldErrors(newFieldErrors);
    }
    return !!results.valid;
  };

  /**
   * Dynamically creates a validation spec based on form state
   * Particularly useful for internal profile editing where certain fields may not be required
   */
  const getDynamicSpec = (override?: { name: keyof TrusteeFormData; value: string }) => {
    const spec: Partial<ValidationSpec<TrusteeFormData>> = { ...TRUSTEE_SPEC };
    const currentFormData = getFormData(override);

    if (doEditInternalProfile) {
      delete spec.name;
      if (
        !currentFormData.address1 &&
        !currentFormData.city &&
        !currentFormData.state &&
        !currentFormData.zipCode
      ) {
        delete spec.address1;
        delete spec.address2;
        delete spec.city;
        delete spec.state;
        delete spec.zipCode;
      }
      if (!currentFormData.phone) {
        delete spec.phone;
      }
      if (!currentFormData.email) {
        delete spec.email;
      }
    }

    return spec;
  };

  return {
    formData,
    updateField,
    updateMultipleFields,
    resetForm,
    getFormData,
    getDynamicSpec,
    fieldErrors,
    validateFieldAndUpdate,
    clearErrors,
    clearFieldError,
    validateFormAndUpdateErrors,
  };
}
