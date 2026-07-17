import { Auditable } from './auditable';
import { Identifiable } from './document';
import { ContactInformation } from './contact';

export type TrusteeStaffInput = {
  name: string;
  title?: string;
  contact?: Partial<ContactInformation>;
};

export type TrusteeStaff = Auditable &
  Identifiable & {
    trusteeId: string;
    name: string;
    title?: string;
    contact?: Partial<ContactInformation>;
  };
