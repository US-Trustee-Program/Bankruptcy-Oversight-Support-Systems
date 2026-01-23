/**
 * User-facing validation error messages for field validation.
 * These constants are used in both validation specs and tests to ensure consistency
 * across the application.
 *
 * These messages have been approved by the UX team and match the frontend validation messages.
 */
export const FIELD_VALIDATION_MESSAGES = {
  ZIP_CODE: 'Must be 5 or 9 digits',
  PHONE_NUMBER: 'Must be a valid phone number',
  PHONE_EXTENSION: 'Must be 1 to 6 digits',
  EMAIL: 'Must be a valid email address',
  EMAIL_PROVIDED: 'Must be a valid email address',
  WEBSITE: 'Website must be a valid URL',
  WEBSITE_MAX_LENGTH: 'Max length 255 characters',
  ZOOM_LINK: 'Must be a valid URL',
  ZOOM_LINK_MAX_LENGTH: 'Max length 255 characters',
  ZOOM_MEETING_ID: 'Must be 9 to 11 digits',
  PASSCODE_REQUIRED: 'Passcode is required',
  COMPANY_NAME: 'Must contain only letters and spaces',
} as const;
