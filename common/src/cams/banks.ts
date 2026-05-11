import { Auditable } from './auditable';
import { Identifiable } from './document';

export type BankProfile = Identifiable &
  Auditable & {
    documentType: 'BANK_PROFILE';
    name: string;
    status: 'active' | 'inactive';
  };

export type BankAuditHistory = Identifiable &
  Auditable & {
    documentType: 'AUDIT_BANK';
    bankId: string;
    before: Partial<BankProfile> | null;
    after: Partial<BankProfile>;
  };
