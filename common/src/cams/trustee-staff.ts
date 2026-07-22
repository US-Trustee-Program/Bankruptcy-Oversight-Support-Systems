import { Auditable } from './auditable';
import { Identifiable } from './document';
import { TrusteeContact } from './trustees';

export type TrusteeStaffInput = {
  name: string;
  title?: string;
  contact?: TrusteeContact;
};

export type TrusteeStaff = Auditable &
  Identifiable & {
    trusteeId: string;
    name: string;
    title?: string;
    contact?: TrusteeContact;
  };
