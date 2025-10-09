import { Auditable } from './auditable';
import { Identifiable } from './document';
import { LegacyAddress } from './parties';
import { ContactInformation } from './contact';
import { CamsUserReference } from './users';
import { OversightRole } from './roles';

// Chapter types supported for trustee assignments
export type ChapterType = '7-panel' | '7-non-panel' | '11' | '11-subchapter-v' | '12' | '13';

export function formatChapterType(chapter: string): string {
  const chapterLabels: Record<ChapterType, string> = {
    '7-panel': '7 - Panel',
    '7-non-panel': '7 - Non-Panel',
    '11': '11',
    '11-subchapter-v': '11 - Subchapter V',
    '12': '12',
    '13': '13',
  };

  return chapterLabels[chapter] || chapter;
}

// Trustee status enumeration
export const TRUSTEE_STATUS_VALUES = ['active', 'not active', 'suspended'] as const;
export type TrusteeStatus = (typeof TRUSTEE_STATUS_VALUES)[number];

export type Trustee = Auditable &
  Identifiable & {
    trusteeId: string;
    name: string;
    public: ContactInformation;
    internal?: Partial<ContactInformation>;
    legacy?: LegacyAddress & {
      phone?: string;
      email?: string;
    };

    districts?: string[];
    chapters?: ChapterType[];
    banks?: string[];
    software?: string;
    status: TrusteeStatus;
  };

export type TrusteeOversightAssignment = Auditable &
  Identifiable & {
    trusteeId: string;
    user: CamsUserReference;
    role: OversightRole;
  };

export type TrusteeInput = Omit<
  Trustee,
  'legacy' | 'trusteeId' | keyof Auditable | keyof Identifiable
>;

type AbstractTrusteeHistory<B, A> = Auditable &
  Identifiable & {
    trusteeId: string;
    before: B | undefined;
    after: A | undefined;
  };

export type TrusteeNameHistory = AbstractTrusteeHistory<string, string> & {
  documentType: 'AUDIT_NAME';
};

export type TrusteePublicContactHistory = AbstractTrusteeHistory<
  ContactInformation,
  ContactInformation
> & {
  documentType: 'AUDIT_PUBLIC_CONTACT';
};

export type TrusteeInternalContactHistory = AbstractTrusteeHistory<
  Partial<ContactInformation>,
  Partial<ContactInformation>
> & {
  documentType: 'AUDIT_INTERNAL_CONTACT';
};

export type TrusteeBankHistory = AbstractTrusteeHistory<string[], string[]> & {
  documentType: 'AUDIT_BANKS';
};

export type TrusteeSoftwareHistory = AbstractTrusteeHistory<string, string> & {
  documentType: 'AUDIT_SOFTWARE';
};

export type TrusteeOversightAssignmentHistory = AbstractTrusteeHistory<
  TrusteeOversightAssignment | null,
  TrusteeOversightAssignment | null
> & {
  documentType: 'AUDIT_OVERSIGHT_ASSIGNMENT';
  assignmentType: 'ATTORNEY' | 'AUDITOR' | 'PARALEGAL';
};

export type TrusteeHistory =
  | TrusteeNameHistory
  | TrusteePublicContactHistory
  | TrusteeInternalContactHistory
  | TrusteeBankHistory
  | TrusteeSoftwareHistory
  | TrusteeOversightAssignmentHistory;
