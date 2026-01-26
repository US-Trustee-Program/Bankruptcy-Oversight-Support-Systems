import { ValidationSpec, ValidatorFunction, ValidatorResult, validateObject } from './validation';
import V from './validators';
import {
  COMPANY_NAME_REGEX,
  EMAIL_REGEX,
  EXTENSION_REGEX,
  PHONE_REGEX,
  WEBSITE_RELAXED_REGEX,
  ZIP_REGEX,
  ZOOM_MEETING_ID_REGEX,
} from './regex';
import { FIELD_VALIDATION_MESSAGES } from './validation-messages';
import { Address, ContactInformation, PhoneNumber } from './contact';
import { TrusteeInput, TrusteeAssistant, ZoomInfo } from './trustees';

// ============================================================================
// FIELD VALIDATORS (Foundational domain validators)
// ============================================================================

export const trusteeName = [V.minLength(1, 'Trustee name is required'), V.maxLength(50)];

export const companyName = [
  V.optional(
    V.matches(COMPANY_NAME_REGEX, FIELD_VALIDATION_MESSAGES.COMPANY_NAME),
    V.maxLength(50),
  ),
];

export const addressLine1 = [
  V.minLength(1, FIELD_VALIDATION_MESSAGES.ADDRESS_REQUIRED),
  V.maxLength(40),
];

export const addressLine2 = [V.optional(V.maxLength(40))];

export const addressLine3 = [V.optional(V.maxLength(40))];

export const city = [V.minLength(1, FIELD_VALIDATION_MESSAGES.CITY_REQUIRED), V.maxLength(50)];

export const state = [V.exactLength(2, FIELD_VALIDATION_MESSAGES.STATE_REQUIRED)];

export const zipCode = [
  V.minLength(1, FIELD_VALIDATION_MESSAGES.ZIP_CODE_REQUIRED),
  V.matches(ZIP_REGEX, FIELD_VALIDATION_MESSAGES.ZIP_CODE),
];

export const countryCode = [V.exactLength(2)];

export const phoneNumber = [V.matches(PHONE_REGEX, FIELD_VALIDATION_MESSAGES.PHONE_NUMBER)];

export const phoneExtension = [
  V.optional(V.matches(EXTENSION_REGEX, FIELD_VALIDATION_MESSAGES.PHONE_EXTENSION)),
];

export const email = [V.matches(EMAIL_REGEX, FIELD_VALIDATION_MESSAGES.EMAIL), V.maxLength(50)];

export const website = [
  V.optional(
    V.matches(WEBSITE_RELAXED_REGEX, FIELD_VALIDATION_MESSAGES.WEBSITE),
    V.maxLength(255, FIELD_VALIDATION_MESSAGES.WEBSITE_MAX_LENGTH),
  ),
];

export const zoomLink = [
  V.minLength(1, FIELD_VALIDATION_MESSAGES.ZOOM_LINK),
  V.matches(WEBSITE_RELAXED_REGEX, FIELD_VALIDATION_MESSAGES.ZOOM_LINK),
  V.maxLength(255, FIELD_VALIDATION_MESSAGES.ZOOM_LINK_MAX_LENGTH),
];

export const zoomPhone = [V.matches(PHONE_REGEX, FIELD_VALIDATION_MESSAGES.PHONE_NUMBER)];

export const zoomMeetingId = [
  V.matches(ZOOM_MEETING_ID_REGEX, FIELD_VALIDATION_MESSAGES.ZOOM_MEETING_ID),
];

export const zoomPasscode = [V.minLength(1, FIELD_VALIDATION_MESSAGES.PASSCODE_REQUIRED)];

export const assistantName = [V.minLength(1)];

// ============================================================================
// COMPOSED VALIDATION SPECS
// ============================================================================

export const addressSpec: ValidationSpec<Address> = {
  address1: addressLine1,
  address2: addressLine2,
  address3: addressLine3,
  city,
  state,
  zipCode,
  countryCode,
};

export const phoneSpec: ValidationSpec<PhoneNumber> = {
  number: phoneNumber,
  extension: phoneExtension,
};

export const contactInformationSpec: ValidationSpec<ContactInformation> = {
  address: [V.spec(addressSpec)],
  phone: [V.optional(V.spec(phoneSpec))],
  email: [V.optional(...email)],
  website,
  companyName,
};

export const internalContactInformationSpec: ValidationSpec<ContactInformation> = {
  address: [V.optional(V.nullable(V.spec(addressSpec)))],
  phone: [V.optional(V.nullable(V.spec(phoneSpec)))],
  email: [V.optional(V.nullable(...email))],
};

export const zoomInfoSpec: ValidationSpec<ZoomInfo> = {
  link: zoomLink,
  phone: zoomPhone,
  meetingId: zoomMeetingId,
  passcode: zoomPasscode,
};

export const assistantSpec: ValidationSpec<TrusteeAssistant> = {
  name: assistantName,
  contact: [V.spec(contactInformationSpec)],
};

export const trusteeSpec: ValidationSpec<TrusteeInput> = {
  name: trusteeName,
  public: [V.optional(V.spec(contactInformationSpec))],
  internal: [V.optional(V.spec(internalContactInformationSpec))],
  assistant: [V.optional(V.spec(assistantSpec))],
  banks: [V.optional(V.arrayOf(V.length(1, 100)))],
  software: [V.optional(V.length(0, 100))],
  zoomInfo: [V.optional(V.nullable(V.spec(zoomInfoSpec)))],
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
