import V from './validators';
import {
  EXTENSION_REGEX,
  PHONE_REGEX,
  WEBSITE_RELAXED_REGEX,
  ZIP_REGEX,
  ZOOM_MEETING_ID_REGEX,
} from './regex';
import { FIELD_VALIDATION_MESSAGES } from './validation-messages';
import { ValidationSpec } from './validation';
import { ZoomInfo, TypedPhoneNumber, TrusteeContact } from './trustees';
import { Address, ContactInformation, PhoneNumber } from './contact';
import { TrusteeStaffInput } from './trustee-staff';

export const trusteeName = V.checkFirst(V.minLength(1, 'Trustee name is required')).then(
  V.maxLength(50),
);

export const FIRST_NAME_MAX = 15;
export const MIDDLE_NAME_MAX = 15;
export const LAST_NAME_MAX = 20;
export const FULL_NAME_MAX = FIRST_NAME_MAX + MIDDLE_NAME_MAX + LAST_NAME_MAX + 2;

export const trusteeFirstName = V.checkFirst(V.minLength(1, 'First name is required')).then(
  V.maxLength(FIRST_NAME_MAX),
);

export const trusteeLastName = V.checkFirst(V.minLength(1, 'Last name is required')).then(
  V.maxLength(LAST_NAME_MAX),
);

export const trusteeMiddleName = V.optional(V.maxLength(MIDDLE_NAME_MAX));

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

import { email, website } from './contact-validators';
export { email, website };

export const zoomLink = V.checkFirst(V.minLength(1, FIELD_VALIDATION_MESSAGES.ZOOM_LINK)).then(
  V.matches(WEBSITE_RELAXED_REGEX, FIELD_VALIDATION_MESSAGES.ZOOM_LINK),
  V.maxLength(255, FIELD_VALIDATION_MESSAGES.ZOOM_LINK_MAX_LENGTH),
);

export const zoomPhone = V.matches(PHONE_REGEX, FIELD_VALIDATION_MESSAGES.PHONE_NUMBER);

export const zoomMeetingId = V.matches(
  ZOOM_MEETING_ID_REGEX,
  FIELD_VALIDATION_MESSAGES.ZOOM_MEETING_ID,
);

export const zoomPasscode = V.minLength(1, FIELD_VALIDATION_MESSAGES.PASSCODE_REQUIRED);

export const staffName = V.minLength(1);

export const staffTitle = V.maxLength(50);

export const zoomInfoSpec: ValidationSpec<ZoomInfo> = {
  link: [zoomLink],
  phone: [zoomPhone],
  meetingId: [zoomMeetingId],
  passcode: [zoomPasscode],
  accountEmail: [V.optional(email)],
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

export const typedPhoneNumberSpec: ValidationSpec<TypedPhoneNumber> = {
  number: [phoneNumber],
  extension: [phoneExtension],
  type: [V.checkFirst(V.minLength(1, 'Phone type is required'))],
};

export const trusteeContactSpec: ValidationSpec<TrusteeContact> = {
  address: [V.optional(V.nullable(V.spec(addressSpec)))],
  phones: [V.optional(V.arrayOf(V.spec(typedPhoneNumberSpec)))],
  email: [V.optional(V.nullable(email))],
};

export const staffInputSpec: ValidationSpec<TrusteeStaffInput> = {
  name: [staffName],
  title: [V.optional(staffTitle)],
  contact: [V.optional(V.spec(trusteeContactSpec))],
};
