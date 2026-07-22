import { Auditable } from './auditable';
import { Identifiable } from './document';
import { LegacyAddress } from './parties';
import { Address, ContactInformation, Person, PhoneNumber } from './contact';
import { CamsUserReference } from './users';
import { OversightRoleType } from './roles';
import { NullableOptionalFields } from '../api/common';
import { TrusteeStaff } from './trustee-staff';
import { AbstractTrusteeHistory } from './trustee-history-base';
import { TrusteeUpcomingKeyDatesHistory } from './trustee-upcoming-key-dates';
import type { TrusteeAppointment } from './trustee-appointments';

export type PhoneType = 'direct' | 'cell' | 'home';
export type TypedPhoneNumber = PhoneNumber & { type: PhoneType };

export const PHONE_TYPES = ['direct', 'cell', 'home'] as const satisfies PhoneType[];
export const PHONE_TYPE_LABELS: Record<PhoneType, string> = {
  direct: 'Direct',
  cell: 'Cell',
  home: 'Home',
};
export type TrusteeContact = Omit<Partial<ContactInformation>, 'phone'> & {
  phones?: TypedPhoneNumber[];
};

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

export type ZoomInfo = {
  link: string;
  phone: string;
  meetingId: string;
  passcode: string;
  accountEmail?: string;
};

type TrusteeCore = Person & {
  name: string;
  status?: AppointmentStatus;
  public: ContactInformation;
  internal?: TrusteeContact;
  staff?: TrusteeStaff[];
};

export function computeTrusteeName(
  firstName: string,
  middleName: string | undefined,
  lastName: string,
): string {
  const parts = [firstName.trim(), middleName?.trim(), lastName.trim()].filter(Boolean);
  return parts.join(' ');
}

export function formatTrusteeListName(
  firstName: string | undefined,
  middleName: string | undefined,
  lastName: string | undefined,
  fallbackName?: string,
): string {
  const last = lastName?.trim();
  const first = firstName?.trim();
  const middle = middleName?.trim();

  if (!last && !first) return fallbackName?.trim() || '';

  const firstMiddle = [first, middle].filter(Boolean).join(' ');
  return firstMiddle ? `${last}, ${firstMiddle}` : last || '';
}

type TrusteeOptionalFields = {
  banks?: string[];
  softwareId?: string;
  zoomInfo?: ZoomInfo;
};

type TrusteeData = TrusteeCore & TrusteeOptionalFields;

export type Trustee = TrusteeData &
  Auditable &
  Identifiable & {
    trusteeId: string;
    phoneticTokens?: string[];
    legacy?: LegacyAddress & {
      phone?: string;
      email?: string;
      truIds?: string[];
      addresses?: LegacyAddress[];
    };
  };

export type TrusteeListItem = Trustee & {
  appointments: TrusteeAppointment[];
};

export type TrusteeSummary = {
  id: string;
  trusteeId: string;
  name: string;
};

// this is needed to map migrated ChapterDetails to our migrated Trustees
export type TrusteeInput = TrusteeCore &
  NullableOptionalFields<TrusteeOptionalFields> & {
    legacy?: {
      truIds?: string[];
      addresses?: LegacyAddress[];
    };
  };

export type TrusteePatchBody = Omit<Partial<Person>, 'middleName'> & {
  middleName?: string | null;
  public?: Partial<Omit<ContactInformation, 'address' | 'phone'>> & {
    address?: Partial<Address>;
    phone?: Partial<PhoneNumber>;
  };
  internal?: TrusteeContact | null;
  banks?: string[] | null;
  softwareId?: string | null;
  zoomInfo?: ZoomInfo | null;
};

export type TrusteeOversightAssignment = Auditable &
  Identifiable & {
    trusteeId: string;
    user: CamsUserReference;
    role: OversightRoleType;
    unassignedOn?: string;
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

export type TrusteeContactHistory = AbstractTrusteeHistory<TrusteeContact, TrusteeContact> & {
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

export type TrusteeStaffHistory = AbstractTrusteeHistory<TrusteeStaff, TrusteeStaff> & {
  documentType: 'AUDIT_STAFF';
  staffId: string;
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
  divisionCodes?: string[];
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

export type TrusteeProfessionalIdHistory = AbstractTrusteeHistory<string, string> & {
  documentType: 'AUDIT_PROFESSIONAL_ID_ASSIGNED';
};

export type TrusteeHistory =
  | TrusteeNameHistory
  | TrusteePublicContactHistory
  | TrusteeContactHistory
  | TrusteeStaffHistory
  | TrusteeBankHistory
  | TrusteeSoftwareHistory
  | TrusteeZoomInfoHistory
  | TrusteeOversightHistory
  | TrusteeAppointmentHistory
  | TrusteeUpcomingKeyDatesHistory
  | TrusteeProfessionalIdHistory;
