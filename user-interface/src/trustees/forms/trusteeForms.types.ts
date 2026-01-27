import {
  ValidationSpec,
  ValidatorFunction,
  ValidatorResult,
  validateObject,
} from '@common/cams/validation';
import V from '@common/cams/validators';
import {
  trusteeName,
  companyName,
  addressLine1,
  addressLine2,
  city,
  state,
  zipCode,
  phoneNumber,
  phoneExtension,
  email,
  website,
} from '@common/cams/trustees-validators';
import { FIELD_VALIDATION_MESSAGES } from '@common/cams/validation-messages';

export type TrusteePublicFormData = {
  name?: string;
  companyName?: string;
  address1?: string;
  address2?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  phone?: string;
  extension?: string;
  email?: string;
  website?: string;
};

export type TrusteeInternalFormData = {
  address1?: string;
  address2?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  phone?: string;
  extension?: string;
  email?: string;
};

export type TrusteeAssistantFormData = {
  name?: string;
  address1?: string;
  address2?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  phone?: string;
  extension?: string;
  email?: string;
};

// ============================================================================
// FORM-LEVEL VALIDATORS (Custom cross-field validation)
// ============================================================================

/**
 * Validates that if any address field is started, all required address fields must be completed.
 * This prevents partial addresses from being submitted.
 */
const completedAddressRequired: ValidatorFunction = (obj: unknown): ValidatorResult => {
  const form = obj as {
    address1?: string;
    address2?: string;
    city?: string;
    state?: string;
    zipCode?: string;
  };

  const hasStartedAddress =
    !!form.address1 || !!form.address2 || !!form.city || !!form.state || !!form.zipCode;

  if (!hasStartedAddress) {
    return { valid: true };
  }

  const requiredFieldsSpec: Readonly<ValidationSpec<typeof form>> = {
    address1: addressLine1,
    city,
    state,
    zipCode,
  };

  const result = validateObject(requiredFieldsSpec, form);
  if (result.valid) {
    return { valid: true };
  } else {
    result.reasonMap = {
      ...result.reasonMap,
      $: {
        reasonMap: result.reasonMap?.$?.reasonMap,
        reasons: [
          ...(result.reasonMap?.$?.reasons ?? []),
          FIELD_VALIDATION_MESSAGES.PARTIAL_ADDRESS,
        ],
      },
    };
    return result;
  }
};

/**
 * Validates that if an extension is provided, a phone number must also be provided.
 */
const phoneRequiredWithExtension: ValidatorFunction = (obj): ValidatorResult => {
  const form = obj as { phone?: string; extension?: string };
  if (form.extension && !form.phone) {
    return {
      reasonMap: { phone: { reasons: [FIELD_VALIDATION_MESSAGES.PHONE_REQUIRED_WITH_EXTENSION] } },
    };
  }
  return { valid: true };
};

// ============================================================================
// FORM-SPECIFIC VALIDATION SPECS (Frontend forms)
// ============================================================================

export const trusteePublicSpec: Readonly<ValidationSpec<TrusteePublicFormData>> = {
  name: trusteeName,
  companyName,
  address1: addressLine1,
  address2: addressLine2,
  city,
  state,
  zipCode,
  email,
  website,
  phone: phoneNumber,
  extension: phoneExtension,
};

export const trusteeInternalSpec: Readonly<ValidationSpec<TrusteeInternalFormData>> = {
  $: [completedAddressRequired, phoneRequiredWithExtension],
  address1: [V.optional(...addressLine1)],
  address2: addressLine2,
  city: [V.optional(...city)],
  state: [V.optional(...state)],
  zipCode: [V.optional(...zipCode)],
  email: [V.optional(...email)],
  phone: [V.optional(...phoneNumber)],
  extension: [V.optional(...phoneExtension)],
};

export const trusteeAssistantSpec: Readonly<ValidationSpec<TrusteeAssistantFormData>> = {
  $: [completedAddressRequired, phoneRequiredWithExtension],
  name: [V.optional(...trusteeName)],
  address1: [V.optional(...addressLine1)],
  address2: addressLine2,
  city: [V.optional(...city)],
  state: [V.optional(...state)],
  zipCode: [V.optional(...zipCode)],
  email: [V.optional(...email)],
  phone: [V.optional(...phoneNumber)],
  extension: [V.optional(...phoneExtension)],
};
