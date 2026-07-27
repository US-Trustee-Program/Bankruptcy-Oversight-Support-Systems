import { Auditable } from './auditable';
import { Identifiable } from './document';
import { Address, PhoneNumber, TypedPhoneNumber } from './contact';

export type SoftwareContactInfo = {
  contactNames?: string[];
  address?: Partial<Address>;
  phones?: TypedPhoneNumber[];
  emails?: string[];
  website?: string;
};

// Audit history records may predate the phones migration and carry the old phone field.
export type SoftwareAuditContactInfo = SoftwareContactInfo & { phone?: Partial<PhoneNumber> };

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
