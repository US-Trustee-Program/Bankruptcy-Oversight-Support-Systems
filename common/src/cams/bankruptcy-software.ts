import { Auditable } from './auditable';
import { Identifiable } from './document';
import { Address, PhoneNumber, TypedPhoneNumber } from './contact';

export type SoftwareContactInfo = {
  contactNames?: string[];
  address?: Partial<Address>;
  phone?: Partial<PhoneNumber>;
  phones?: TypedPhoneNumber[];
  emails?: string[];
  website?: string;
};

export type SoftwareBankAssociation = {
  bankId: string;
  bankName: string;
  status: 'active' | 'inactive';
};

export type BankruptcySoftwareProfile = Identifiable &
  Auditable & {
    documentType: 'BANKRUPTCY_SOFTWARE';
    name: string;
    status: 'active' | 'inactive';
    contact?: SoftwareContactInfo;
    associatedBanks?: SoftwareBankAssociation[];
  };

export type BankruptcySoftwareAuditHistory = Identifiable &
  Auditable & {
    documentType: 'AUDIT_BANKRUPTCY_SOFTWARE';
    softwareId: string;
    before: Partial<BankruptcySoftwareProfile> | null;
    after: Partial<BankruptcySoftwareProfile>;
  };
