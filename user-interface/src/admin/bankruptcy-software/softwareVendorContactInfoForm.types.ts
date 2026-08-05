import { ValidationSpec } from '@common/cams/validation';
import { phoneNumber, phoneExtension, email, website } from '@common/cams/contact-validators';
import { TypedPhoneNumber } from '@common/cams/contact';

export type SoftwareContactFormData = {
  phone?: string;
  extension?: string;
  email?: string;
  website?: string;
};

export const softwareContactSpec: Readonly<ValidationSpec<SoftwareContactFormData>> = {
  phone: [phoneNumber],
  extension: [phoneExtension],
  email: [email],
  website: [website],
};

export const DEFAULT_PHONE_ENTRY: TypedPhoneNumber = { type: 'direct', number: '' };
