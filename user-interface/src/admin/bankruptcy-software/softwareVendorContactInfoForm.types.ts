import { ValidationSpec } from '@common/cams/validation';
import { phoneNumber, phoneExtension, email, website } from '@common/cams/contact-validators';

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
