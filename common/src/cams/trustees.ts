import { Auditable } from './auditable';
import { Identifiable } from './document';
import { LegacyAddress } from './parties';
import { ContactInformation } from './contact';
import { CamsUserReference } from './users';
import { OversightRoleType } from './roles';
import { NullableOptionalFields } from '../api/common';

// Chapter types supported for trustee assignments
export type ChapterType = '7-panel' | '7-non-panel' | '11' | '11-subchapter-v' | '12' | '13';

export function formatChapterType(chapter: string): string {
  const chapterLabels = {
    '7-panel': '7 - Panel',
    '7-non-panel': '7 - Non-Panel',
    '11': '11',
    '11-subchapter-v': '11 - Subchapter V',
    '12': '12',
    '13': '13',
  } as Record<string, string>;

  return chapterLabels[chapter] || chapter;
}

export const TRUSTEE_STATUS_VALUES = ['active', 'not active', 'suspended'] as const;

type TrusteeCore = {
  name: string;
  public: ContactInformation;
  internal?: Partial<ContactInformation>;
};

type TrusteeOptionalFields = {
  banks?: string[];
  software?: string;
};

type TrusteeData = TrusteeCore & TrusteeOptionalFields;

export type Trustee = TrusteeData &
  Auditable &
  Identifiable & {
    trusteeId: string;
    legacy?: LegacyAddress & {
      phone?: string;
      email?: string;
    };
  };

export type TrusteeInput = TrusteeCore & NullableOptionalFields<TrusteeOptionalFields>;

export type TrusteeOversightAssignment = Auditable &
  Identifiable & {
    trusteeId: string;
    user: CamsUserReference;
    role: OversightRoleType;
    unassignedOn?: string;
  };

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

type UserAndRole = { user: CamsUserReference; role: OversightRoleType };
export type TrusteeOversightHistory = AbstractTrusteeHistory<
  UserAndRole | null,
  UserAndRole | null
> & {
  documentType: 'AUDIT_OVERSIGHT';
};

type AppointmentData = {
  chapter: ChapterType;
  courtId: string;
  divisionCode: string;
  courtName?: string;
  courtDivisionName?: string;
  appointedDate: string;
  status: 'active' | 'inactive';
  effectiveDate: string;
};

export type TrusteeAppointmentHistory = AbstractTrusteeHistory<AppointmentData, AppointmentData> & {
  documentType: 'AUDIT_APPOINTMENT';
  appointmentId: string;
};

export type TrusteeHistory =
  | TrusteeNameHistory
  | TrusteePublicContactHistory
  | TrusteeInternalContactHistory
  | TrusteeBankHistory
  | TrusteeSoftwareHistory
  | TrusteeOversightHistory
  | TrusteeAppointmentHistory;
