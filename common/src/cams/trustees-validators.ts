import V from './validators';
import {
  EMAIL_REGEX,
  EXTENSION_REGEX,
  PHONE_REGEX,
  WEBSITE_RELAXED_REGEX,
  ZIP_REGEX,
  ZOOM_MEETING_ID_REGEX,
} from './regex';
import { FIELD_VALIDATION_MESSAGES } from './validation-messages';
import { ValidationSpec } from './validation';
import { ZoomInfo } from './trustees';
import { Address, ContactInformation, PhoneNumber } from './contact';
import { TrusteeAssistantInput } from './trustee-assistants';

export const trusteeName = V.checkFirst(V.minLength(1, 'Trustee name is required')).then(
  V.maxLength(50),
);

export const companyName = V.optional(V.maxLength(50));

export const addressLine1 = V.checkFirst(
  V.minLength(1, FIELD_VALIDATION_MESSAGES.ADDRESS_REQUIRED),
).then(V.maxLength(40));

export const addressLine2 = V.optional(V.maxLength(40));

export const addressLine3 = V.optional(V.maxLength(40));

export const city = V.checkFirst(V.minLength(1, FIELD_VALIDATION_MESSAGES.CITY_REQUIRED)).then(
  V.maxLength(50),
);

export const state = V.exactLength(2, FIELD_VALIDATION_MESSAGES.STATE_REQUIRED);

export const zipCode = V.checkFirst(
  V.minLength(1, FIELD_VALIDATION_MESSAGES.ZIP_CODE_REQUIRED),
).then(V.matches(ZIP_REGEX, FIELD_VALIDATION_MESSAGES.ZIP_CODE));

export const countryCode = V.exactLength(2);

export const phoneNumber = V.matches(PHONE_REGEX, FIELD_VALIDATION_MESSAGES.PHONE_NUMBER);

export const phoneExtension = V.optional(
  V.matches(EXTENSION_REGEX, FIELD_VALIDATION_MESSAGES.PHONE_EXTENSION),
);

export const email = V.useValidators(
  V.matches(EMAIL_REGEX, FIELD_VALIDATION_MESSAGES.EMAIL),
  V.maxLength(50),
);

export const website = V.optional(
  V.matches(WEBSITE_RELAXED_REGEX, FIELD_VALIDATION_MESSAGES.WEBSITE),
  V.maxLength(255, FIELD_VALIDATION_MESSAGES.WEBSITE_MAX_LENGTH),
);

export const zoomLink = V.useValidators(
  V.minLength(1, FIELD_VALIDATION_MESSAGES.ZOOM_LINK),
  V.matches(WEBSITE_RELAXED_REGEX, FIELD_VALIDATION_MESSAGES.ZOOM_LINK),
  V.maxLength(255, FIELD_VALIDATION_MESSAGES.ZOOM_LINK_MAX_LENGTH),
);

export const zoomPhone = V.matches(PHONE_REGEX, FIELD_VALIDATION_MESSAGES.PHONE_NUMBER);

export const zoomMeetingId = V.matches(
  ZOOM_MEETING_ID_REGEX,
  FIELD_VALIDATION_MESSAGES.ZOOM_MEETING_ID,
);

export const zoomPasscode = V.minLength(1, FIELD_VALIDATION_MESSAGES.PASSCODE_REQUIRED);

export const assistantName = V.minLength(1);

export const assistantTitle = V.maxLength(50);

export const zoomInfoSpec: ValidationSpec<ZoomInfo> = {
  link: [zoomLink],
  phone: [zoomPhone],
  meetingId: [zoomMeetingId],
  passcode: [zoomPasscode],
};

export const addressSpec: ValidationSpec<Address> = {
  address1: [addressLine1],
  address2: [addressLine2],
  address3: [addressLine3],
  city: [city],
  state: [state],
  zipCode: [zipCode],
  countryCode: [countryCode],
};

export const phoneSpec: ValidationSpec<PhoneNumber> = {
  number: [phoneNumber],
  extension: [phoneExtension],
};

export const contactInformationSpec: ValidationSpec<ContactInformation> = {
  address: [V.spec(addressSpec)],
  phone: [V.optional(V.spec(phoneSpec))],
  email: [V.optional(email)],
  website: [website],
  companyName: [companyName],
};

export const assistantContactInformationSpec: ValidationSpec<ContactInformation> = {
  ...contactInformationSpec,
  address: [V.optional(V.spec(addressSpec))],
};

export const assistantInputSpec: ValidationSpec<TrusteeAssistantInput> = {
  name: [assistantName],
  title: [V.optional(assistantTitle)],
  contact: [V.optional(V.spec(assistantContactInformationSpec))],
};
