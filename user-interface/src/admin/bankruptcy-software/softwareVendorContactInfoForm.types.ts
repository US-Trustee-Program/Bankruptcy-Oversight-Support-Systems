import { ValidationSpec } from '@common/cams/validation';
import { email, website } from '@common/cams/contact-validators';
import { TypedPhoneNumber } from '@common/cams/contact';

export type SoftwareContactFormData = {
  email?: string;
  website?: string;
};

export const softwareContactSpec: Readonly<ValidationSpec<SoftwareContactFormData>> = {
  email: [email],
  website: [website],
};

export const DEFAULT_PHONE_ENTRY: TypedPhoneNumber = { type: 'direct', number: '' };
