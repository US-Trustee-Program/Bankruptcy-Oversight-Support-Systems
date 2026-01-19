import {
  EMAIL_REGEX,
  EXTENSION_REGEX,
  PHONE_REGEX,
  WEBSITE_RELAXED_REGEX,
  ZIP_REGEX,
} from '@common/cams/regex';
import { VALID, validateObject, ValidationSpec, ValidatorFunction } from '@common/cams/validation';
import V from '@common/cams/validators';
import { FIELD_VALIDATION_MESSAGES } from '@common/cams/validation-messages';

export const ADDRESS_REQUIRED_ERROR_REASON = 'Address is required';
const ADDRESS_MAX_LENGTH_ERROR_REASON = 'Max length 40 characters';
export const PARTIAL_ADDRESS_ERROR_REASON =
  'You have entered a partial address. Please complete or clear the address fields.';
const TRUSTEE_NAME_REQUIRED_ERROR_REASON = 'Trustee name is required';
const TRUSTEE_NAME_MAX_LENGTH_ERROR_REASON = 'Max length 50 characters';
export const CITY_REQUIRED_ERROR_REASON = 'City is required';
const CITY_MAX_LENGTH_ERROR_REASON = 'Max length 50 characters';
export const STATE_REQUIRED_ERROR_REASON = 'State is required';
export const ZIP_CODE_REQUIRED_ERROR_REASON = 'ZIP Code is required';
const EMAIL_MAX_LENGTH_ERROR_REASON = 'Max length 50 characters';
const PHONE_REQUIRED_WITH_EXTENSION_ERROR_REASON =
  'Phone number is required when extension is provided';

export type TrusteeInternalFormData = {
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

export type TrusteePublicFormData = {
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
};

const name = [
  V.minLength(1, TRUSTEE_NAME_REQUIRED_ERROR_REASON),
  V.maxLength(50, TRUSTEE_NAME_MAX_LENGTH_ERROR_REASON),
];
const address1 = [
  V.minLength(1, ADDRESS_REQUIRED_ERROR_REASON),
  V.maxLength(40, ADDRESS_MAX_LENGTH_ERROR_REASON),
];
const address2 = [V.optional(V.maxLength(40, ADDRESS_MAX_LENGTH_ERROR_REASON))];
const city = [
  V.minLength(1, CITY_REQUIRED_ERROR_REASON),
  V.maxLength(50, CITY_MAX_LENGTH_ERROR_REASON),
];
const state = [V.exactLength(2, STATE_REQUIRED_ERROR_REASON)];
const zipCode = [V.matches(ZIP_REGEX, FIELD_VALIDATION_MESSAGES.ZIP_CODE)];
const email = [
  V.matches(EMAIL_REGEX, FIELD_VALIDATION_MESSAGES.EMAIL),
  V.maxLength(50, EMAIL_MAX_LENGTH_ERROR_REASON),
];
const phone = [V.matches(PHONE_REGEX, FIELD_VALIDATION_MESSAGES.PHONE_NUMBER)];
const extension = [
  V.optional(V.matches(EXTENSION_REGEX, FIELD_VALIDATION_MESSAGES.PHONE_EXTENSION)),
];
const website = [
  V.optional(
    V.matches(WEBSITE_RELAXED_REGEX, FIELD_VALIDATION_MESSAGES.WEBSITE),
    V.maxLength(255, FIELD_VALIDATION_MESSAGES.WEBSITE_MAX_LENGTH),
  ),
];

const addressSpec: ValidationSpec<TrusteeInternalFormData> = {
  address1,
  address2,
  city,
  state,
  zipCode,
};

const phoneRequiredWithExtension: ValidatorFunction = (obj) => {
  const form = obj as TrusteeInternalFormData;
  if (form.extension && !form.phone) {
    return {
      reasonMap: { phone: { reasons: [PHONE_REQUIRED_WITH_EXTENSION_ERROR_REASON] } },
    };
  }
  return VALID;
};

const completedAddressRequired: ValidatorFunction = (obj: unknown) => {
  const form = obj as TrusteeInternalFormData;

  const requiredFieldsSpec: Readonly<ValidationSpec<TrusteeInternalFormData>> = {
    address1: [V.minLength(1, ADDRESS_REQUIRED_ERROR_REASON)],
    city: [V.minLength(1, CITY_REQUIRED_ERROR_REASON)],
    state: [V.minLength(1, STATE_REQUIRED_ERROR_REASON)],
    zipCode: [V.minLength(1, ZIP_CODE_REQUIRED_ERROR_REASON)],
  };

  const areAnyFieldsFilled = (form: TrusteeInternalFormData) => {
    for (const key of Object.keys(addressSpec)) {
      if (form[key as keyof TrusteeInternalFormData]) {
        return true;
      }
    }
    return false;
  };

  if (areAnyFieldsFilled(form)) {
    const result = validateObject(requiredFieldsSpec, form);
    if (result.valid) {
      return VALID;
    } else {
      result.reasonMap = {
        ...result.reasonMap,
        $: {
          reasonMap: result.reasonMap?.$?.reasonMap,
          reasons: [...(result.reasonMap?.$?.reasons ?? []), PARTIAL_ADDRESS_ERROR_REASON],
        },
      };
      return result;
    }
  } else {
    return VALID;
  }
};

export const TRUSTEE_INTERNAL_SPEC: Readonly<ValidationSpec<TrusteeInternalFormData>> = {
  $: [completedAddressRequired, phoneRequiredWithExtension],
  address1: [V.optional(...address1)],
  address2,
  city: [V.optional(...city)],
  state: [V.optional(...state)],
  zipCode: [V.optional(...zipCode)],
  email: [V.optional(...email)],
  phone: [V.optional(...phone)],
  extension,
};

export const TRUSTEE_PUBLIC_SPEC: Readonly<ValidationSpec<TrusteePublicFormData>> = {
  name,
  address1,
  address2,
  city,
  state,
  zipCode,
  email,
  website,
  phone,
  extension,
};
