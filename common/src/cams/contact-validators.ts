import V from './validators';
import { EMAIL_REGEX, WEBSITE_RELAXED_REGEX } from './regex';
import { FIELD_VALIDATION_MESSAGES } from './validation-messages';

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
