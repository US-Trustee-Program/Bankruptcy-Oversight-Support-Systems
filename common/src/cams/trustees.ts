import { Auditable } from './auditable';
import { Identifiable } from './document';
import { LegacyAddress } from './parties';
import { ContactInformation } from './contact';
import { CamsUserReference } from './users';
import { OversightRoleType } from './roles';
import { NullableOptionalFields } from '../api/common';
import { TrusteeAssistant } from './trustee-assistants';

export type AppointmentChapterType = '7' | '11' | '11-subchapter-v' | '12' | '13';

export type AppointmentType =
  | 'panel'
  | 'off-panel'
  | 'case-by-case'
  | 'pool'
  | 'out-of-pool'
  | 'standing'
  | 'elected'
  | 'converted-case';

export type AppointmentStatus =
  | 'active'
  | 'inactive'
  | 'voluntarily-suspended'
  | 'involuntarily-suspended'
  | 'deceased'
  | 'resigned'
  | 'terminated'
  | 'removed';

export function getAppointmentDetails(
  chapter: AppointmentChapterType,
  appointmentType: AppointmentType,
): string {
  const chapterTypeString = formatChapterType(chapter);
  const appointmentTypeString = formatAppointmentType(appointmentType);

  return `${chapterTypeString} - ${appointmentTypeString}`;
}

export function formatChapterType(chapter: AppointmentChapterType): string {
  const chapterLabels: Partial<Record<AppointmentChapterType, string>> = {
    '11-subchapter-v': '11 Subchapter V',
  };

  return chapterLabels[chapter] || chapter;
}

export function formatAppointmentType(appointmentType: AppointmentType): string {
  const appointmentTypeLabels: Record<AppointmentType, string> = {
    panel: 'Panel',
    pool: 'Pool',
    'off-panel': 'Off Panel',
    'case-by-case': 'Case by Case',
    'out-of-pool': 'Out of Pool',
    standing: 'Standing',
    elected: 'Elected',
    'converted-case': 'Converted Case',
  };

  return appointmentTypeLabels[appointmentType];
}

export const TRUSTEE_STATUS_VALUES = ['active', 'not active', 'suspended'] as const;

export type ZoomInfo = {
  link: string;
  phone: string;
  meetingId: string;
  passcode: string;
};

type TrusteeCore = {
  name: string;
  public: ContactInformation;
  internal?: Partial<ContactInformation>;
  assistant?: TrusteeAssistant; // TODO: CAMS-686 - Remove in Slice 6
  assistants?: TrusteeAssistant[]; // New field for multiple assistants
};

type TrusteeOptionalFields = {
  banks?: string[];
  software?: string;
  zoomInfo?: ZoomInfo;
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

export type TrusteeZoomInfoHistory = AbstractTrusteeHistory<
  ZoomInfo | undefined,
  ZoomInfo | undefined
> & {
  documentType: 'AUDIT_ZOOM_INFO';
};

export type TrusteeAssistantHistory = AbstractTrusteeHistory<TrusteeAssistant, TrusteeAssistant> & {
  documentType: 'AUDIT_ASSISTANT';
  assistantId: string;
};

type UserAndRole = { user: CamsUserReference; role: OversightRoleType };
export type TrusteeOversightHistory = AbstractTrusteeHistory<
  UserAndRole | null,
  UserAndRole | null
> & {
  documentType: 'AUDIT_OVERSIGHT';
};

type AppointmentData = {
  chapter: AppointmentChapterType;
  appointmentType: AppointmentType;
  courtId: string;
  divisionCode: string;
  courtName?: string;
  courtDivisionName?: string;
  appointedDate: string;
  status: AppointmentStatus;
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
  | TrusteeAssistantHistory
  | TrusteeBankHistory
  | TrusteeSoftwareHistory
  | TrusteeZoomInfoHistory
  | TrusteeOversightHistory
  | TrusteeAppointmentHistory;
