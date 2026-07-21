import { Auditable } from './auditable';
import { Identifiable } from './document';
import { TrusteeInternalContact } from './trustees';

export type TrusteeStaffContact = TrusteeInternalContact;

export type TrusteeStaffInput = {
  name: string;
  title?: string;
  contact?: TrusteeStaffContact;
};

export type TrusteeStaff = Auditable &
  Identifiable & {
    trusteeId: string;
    name: string;
    title?: string;
    contact?: TrusteeStaffContact;
  };
