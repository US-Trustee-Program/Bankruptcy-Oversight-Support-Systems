import {
  EMAIL_REGEX,
  EXTENSION_REGEX,
  PHONE_REGEX,
  WEBSITE_RELAXED_REGEX,
  ZIP_REGEX,
} from '@common/cams/regex';
import { VALID, ValidationSpec, ValidatorFunction, ValidatorResult } from '@common/cams/validation';
import V from '@common/cams/validators';

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

const name = [V.minLength(1, 'Trustee name is required'), V.maxLength(50)];
const address1 = [V.minLength(1, 'Address is required'), V.maxLength(40)];
const address2 = [V.optional(V.maxLength(40))];
const city = [V.minLength(1, 'City is required'), V.maxLength(50)];
const state = [V.exactLength(2, 'State is required')];
const zipCode = [V.matches(ZIP_REGEX, 'ZIP code must be 5 digits or 9 digits with a hyphen')];
const email = [V.matches(EMAIL_REGEX, 'Email must be a valid email address'), V.maxLength(50)];
const phone = [V.matches(PHONE_REGEX, 'Phone must be a valid phone number')];
const extension = [V.optional(V.matches(EXTENSION_REGEX, 'Extension must be 1 to 6 digits'))];
const website = [
  V.optional(V.matches(WEBSITE_RELAXED_REGEX, 'Website must be a valid URL'), V.maxLength(255)),
];

const phoneRequiredWithExtension: ValidatorFunction = (obj) => {
  const form = obj as TrusteeInternalFormData;
  if (form.extension && !form.phone) {
    return {
      reasonMap: { phone: { reasons: ['Phone number is required when extension is provided'] } },
    };
  }
  return VALID;
};

export const TRUSTEE_INTERNAL_SPEC: Readonly<ValidationSpec<TrusteeInternalFormData>> = {
  $: [phoneRequiredWithExtension],
  address1,
  address2,
  city,
  state,
  zipCode,
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
