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

export const trusteeName = V.useValidators(
  V.minLength(1, 'Trustee name is required'),
  V.optional(V.maxLength(50)),
);

export const companyName = V.optional(V.maxLength(50));

export const addressLine1 = V.useValidators(
  V.minLength(1, FIELD_VALIDATION_MESSAGES.ADDRESS_REQUIRED),
  V.optional(V.maxLength(40)),
);

export const addressLine2 = V.optional(V.maxLength(40));

export const addressLine3 = V.optional(V.maxLength(40));

export const city = V.useValidators(
  V.minLength(1, FIELD_VALIDATION_MESSAGES.CITY_REQUIRED),
  V.optional(V.maxLength(50)),
);

export const state = V.exactLength(2, FIELD_VALIDATION_MESSAGES.STATE_REQUIRED);

export const zipCode = V.useValidators(
  V.minLength(1, FIELD_VALIDATION_MESSAGES.ZIP_CODE_REQUIRED),
  V.matches(ZIP_REGEX, FIELD_VALIDATION_MESSAGES.ZIP_CODE),
);

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
