import { Auditable } from './auditable';
import { Identifiable } from './document';
import { LegacyAddress } from './parties';
import { ContactInformation } from './contact';

// Chapter types supported for trustee assignments
export type ChapterType = '7' | '7-panel' | '7-non-panel' | '11' | '11-subchapter-v' | '12' | '13';

// Trustee status enumeration
export const TRUSTEE_STATUS_VALUES = ['active', 'not active', 'suspended'] as const;
export type TrusteeStatus = (typeof TRUSTEE_STATUS_VALUES)[number];

export type Trustee = Auditable &
  Identifiable & {
    name: string;
    public: ContactInformation;
    internal?: ContactInformation;
    legacy?: LegacyAddress & {
      phone?: string;
      email?: string;
    };

    districts?: string[];
    chapters?: ChapterType[];
    status: TrusteeStatus;
  };

export type TrusteeInput = Omit<Trustee, 'legacy' | keyof Auditable | keyof Identifiable>;
