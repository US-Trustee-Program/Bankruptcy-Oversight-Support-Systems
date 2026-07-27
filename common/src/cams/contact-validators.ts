import V from './validators';
import { EMAIL_REGEX, EXTENSION_REGEX, PHONE_REGEX, WEBSITE_RELAXED_REGEX } from './regex';
import { FIELD_VALIDATION_MESSAGES } from './validation-messages';
import { ValidationSpec } from './validation';
import { MAX_PHONE_NUMBERS, PhoneNumber, TypedPhoneNumber } from './contact';

export const email = V.checkFirst(V.matches(EMAIL_REGEX, FIELD_VALIDATION_MESSAGES.EMAIL)).then(
  V.maxLength(254),
);

export const website = V.skip(
  (v) => v === undefined || v === null || v === '',
  [
    V.matches(WEBSITE_RELAXED_REGEX, FIELD_VALIDATION_MESSAGES.WEBSITE),
    V.maxLength(255, FIELD_VALIDATION_MESSAGES.WEBSITE_MAX_LENGTH),
  ],
);

export const phoneNumber = V.matches(PHONE_REGEX, FIELD_VALIDATION_MESSAGES.PHONE_NUMBER);

export const phoneExtension = V.optional(
  V.matches(EXTENSION_REGEX, FIELD_VALIDATION_MESSAGES.PHONE_EXTENSION),
);

export const phoneSpec: ValidationSpec<PhoneNumber> = {
  number: [phoneNumber],
  extension: [phoneExtension],
};

export const typedPhoneNumberSpec: ValidationSpec<TypedPhoneNumber> = {
  number: [phoneNumber],
  extension: [phoneExtension],
  type: [V.checkFirst(V.minLength(1, 'Phone type is required'))],
};

export const MAX_PHONE_NUMBERS_MESSAGE = `No more than ${MAX_PHONE_NUMBERS} phone numbers are allowed.`;
