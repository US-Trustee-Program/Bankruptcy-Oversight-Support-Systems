import { Auditable } from './auditable';
import { Identifiable } from './document';
import { LegacyAddress } from './parties';
import { Address, ContactInformation, PhoneNumber } from './contact';
import { CamsUserReference } from './users';
import { OversightRoleType } from './roles';
import { NullableOptionalFields } from '../api/common';
import { ValidationSpec, ValidatorFunction, ValidatorResult, validateObject } from './validation';
import V from './validators';
import {
  COMPANY_NAME_REGEX,
  EMAIL_REGEX,
  EXTENSION_REGEX,
  PHONE_REGEX,
  WEBSITE_RELAXED_REGEX,
  ZIP_REGEX,
  ZOOM_MEETING_ID_REGEX,
} from './regex';
import { FIELD_VALIDATION_MESSAGES } from './validation-messages';

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

export type TrusteeAssistant = {
  name: string;
  contact: ContactInformation;
};

type TrusteeCore = {
  name: string;
  public: ContactInformation;
  internal?: Partial<ContactInformation>;
  assistant?: TrusteeAssistant;
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

export const addressSpec: ValidationSpec<Address> = {
  address1: [V.minLength(1, FIELD_VALIDATION_MESSAGES.ADDRESS_REQUIRED), V.maxLength(40)],
  address2: [V.optional(V.maxLength(40))],
  address3: [V.optional(V.maxLength(40))],
  city: [V.minLength(1, FIELD_VALIDATION_MESSAGES.CITY_REQUIRED), V.maxLength(50)],
  state: [V.exactLength(2, FIELD_VALIDATION_MESSAGES.STATE_REQUIRED)],
  zipCode: [V.matches(ZIP_REGEX, FIELD_VALIDATION_MESSAGES.ZIP_CODE)],
  countryCode: [V.exactLength(2)],
};

export const phoneSpec: ValidationSpec<PhoneNumber> = {
  number: [V.matches(PHONE_REGEX, FIELD_VALIDATION_MESSAGES.PHONE_NUMBER)],
  extension: [V.optional(V.matches(EXTENSION_REGEX, FIELD_VALIDATION_MESSAGES.PHONE_EXTENSION))],
};

export const contactInformationSpec: ValidationSpec<ContactInformation> = {
  address: [V.spec(addressSpec)],
  phone: [V.optional(V.spec(phoneSpec))],
  email: [V.optional(V.matches(EMAIL_REGEX, FIELD_VALIDATION_MESSAGES.EMAIL), V.maxLength(50))],
  website: [
    V.optional(
      V.matches(WEBSITE_RELAXED_REGEX, FIELD_VALIDATION_MESSAGES.WEBSITE),
      V.maxLength(255, FIELD_VALIDATION_MESSAGES.WEBSITE_MAX_LENGTH),
    ),
  ],
  companyName: [
    V.optional(
      V.matches(COMPANY_NAME_REGEX, FIELD_VALIDATION_MESSAGES.COMPANY_NAME),
      V.maxLength(50),
    ),
  ],
};

export const internalContactInformationSpec: ValidationSpec<ContactInformation> = {
  address: [V.optional(V.nullable(V.spec(addressSpec)))],
  phone: [V.optional(V.nullable(V.spec(phoneSpec)))],
  email: [V.optional(V.nullable(V.matches(EMAIL_REGEX, FIELD_VALIDATION_MESSAGES.EMAIL_PROVIDED)))],
};

export const zoomInfoSpec: ValidationSpec<ZoomInfo> = {
  link: [
    V.minLength(1, FIELD_VALIDATION_MESSAGES.ZOOM_LINK),
    V.matches(WEBSITE_RELAXED_REGEX, FIELD_VALIDATION_MESSAGES.ZOOM_LINK),
    V.maxLength(255, FIELD_VALIDATION_MESSAGES.ZOOM_LINK_MAX_LENGTH),
  ],
  phone: [V.matches(PHONE_REGEX, FIELD_VALIDATION_MESSAGES.PHONE_NUMBER)],
  meetingId: [V.matches(ZOOM_MEETING_ID_REGEX, FIELD_VALIDATION_MESSAGES.ZOOM_MEETING_ID)],
  passcode: [V.minLength(1, FIELD_VALIDATION_MESSAGES.PASSCODE_REQUIRED)],
};

export const assistantSpec: ValidationSpec<TrusteeAssistant> = {
  name: [V.minLength(1)],
  contact: [V.spec(contactInformationSpec)],
};

// Custom validator functions for trustee forms
const completedAddressRequired: ValidatorFunction = (obj: unknown): ValidatorResult => {
  const form = obj as {
    address1?: string;
    address2?: string;
    city?: string;
    state?: string;
    zipCode?: string;
  };

  const hasStartedAddress =
    !!form.address1 || !!form.address2 || !!form.city || !!form.state || !!form.zipCode;

  if (!hasStartedAddress) {
    return { valid: true };
  }

  const requiredFieldsSpec: Readonly<ValidationSpec<typeof form>> = {
    address1: [V.minLength(1, FIELD_VALIDATION_MESSAGES.ADDRESS_REQUIRED)],
    city: [V.minLength(1, FIELD_VALIDATION_MESSAGES.CITY_REQUIRED)],
    state: [V.minLength(1, FIELD_VALIDATION_MESSAGES.STATE_REQUIRED)],
    zipCode: [V.minLength(1, FIELD_VALIDATION_MESSAGES.ZIP_CODE_REQUIRED)],
  };

  const result = validateObject(requiredFieldsSpec, form);
  if (result.valid) {
    return { valid: true };
  } else {
    result.reasonMap = {
      ...result.reasonMap,
      $: {
        reasonMap: result.reasonMap?.$?.reasonMap,
        reasons: [
          ...(result.reasonMap?.$?.reasons ?? []),
          FIELD_VALIDATION_MESSAGES.PARTIAL_ADDRESS,
        ],
      },
    };
    return result;
  }
};

const phoneRequiredWithExtension: ValidatorFunction = (obj): ValidatorResult => {
  const form = obj as { phone?: string; extension?: string };
  if (form.extension && !form.phone) {
    return {
      reasonMap: { phone: { reasons: [FIELD_VALIDATION_MESSAGES.PHONE_REQUIRED_WITH_EXTENSION] } },
    };
  }
  return { valid: true };
};

export const trusteeSpec: ValidationSpec<TrusteeInput> = {
  name: [V.minLength(1, 'Trustee name is required'), V.maxLength(50)],
  public: [V.optional(V.spec(contactInformationSpec))],
  internal: [V.optional(V.spec(internalContactInformationSpec))],
  assistant: [V.optional(V.spec(assistantSpec))],
  banks: [V.optional(V.arrayOf(V.length(1, 100)))],
  software: [V.optional(V.length(0, 100))],
  zoomInfo: [V.optional(V.nullable(V.spec(zoomInfoSpec)))],
};

// Form-specific validation specs for frontend use
export type TrusteePublicFormData = {
  name?: string;
  companyName?: string;
  address1?: string;
  address2?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  phone?: string;
  extension?: string;
  email?: string;
  website?: string;
};

export type TrusteeInternalFormData = {
  address1?: string;
  address2?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  phone?: string;
  extension?: string;
  email?: string;
};

export type TrusteeAssistantFormData = {
  name?: string;
  address1?: string;
  address2?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  phone?: string;
  extension?: string;
  email?: string;
};

export const TRUSTEE_PUBLIC_SPEC: Readonly<ValidationSpec<TrusteePublicFormData>> = {
  name: [V.minLength(1, 'Trustee name is required'), V.maxLength(50)],
  companyName: [
    V.optional(
      V.matches(COMPANY_NAME_REGEX, FIELD_VALIDATION_MESSAGES.COMPANY_NAME),
      V.maxLength(50),
    ),
  ],
  address1: [V.minLength(1, FIELD_VALIDATION_MESSAGES.ADDRESS_REQUIRED), V.maxLength(40)],
  address2: [V.optional(V.maxLength(40))],
  city: [V.minLength(1, FIELD_VALIDATION_MESSAGES.CITY_REQUIRED), V.maxLength(50)],
  state: [V.exactLength(2, FIELD_VALIDATION_MESSAGES.STATE_REQUIRED)],
  zipCode: [V.matches(ZIP_REGEX, FIELD_VALIDATION_MESSAGES.ZIP_CODE)],
  email: [V.matches(EMAIL_REGEX, FIELD_VALIDATION_MESSAGES.EMAIL), V.maxLength(50)],
  website: [
    V.optional(
      V.matches(WEBSITE_RELAXED_REGEX, FIELD_VALIDATION_MESSAGES.WEBSITE),
      V.maxLength(255, FIELD_VALIDATION_MESSAGES.WEBSITE_MAX_LENGTH),
    ),
  ],
  phone: [V.matches(PHONE_REGEX, FIELD_VALIDATION_MESSAGES.PHONE_NUMBER)],
  extension: [V.optional(V.matches(EXTENSION_REGEX, FIELD_VALIDATION_MESSAGES.PHONE_EXTENSION))],
};

export const TRUSTEE_INTERNAL_SPEC: Readonly<ValidationSpec<TrusteeInternalFormData>> = {
  $: [completedAddressRequired, phoneRequiredWithExtension],
  address1: [
    V.optional(V.minLength(1, FIELD_VALIDATION_MESSAGES.ADDRESS_REQUIRED), V.maxLength(40)),
  ],
  address2: [V.optional(V.maxLength(40))],
  city: [V.optional(V.minLength(1, FIELD_VALIDATION_MESSAGES.CITY_REQUIRED), V.maxLength(50))],
  state: [V.optional(V.exactLength(2, FIELD_VALIDATION_MESSAGES.STATE_REQUIRED))],
  zipCode: [V.optional(V.matches(ZIP_REGEX, FIELD_VALIDATION_MESSAGES.ZIP_CODE))],
  email: [V.optional(V.matches(EMAIL_REGEX, FIELD_VALIDATION_MESSAGES.EMAIL), V.maxLength(50))],
  phone: [V.optional(V.matches(PHONE_REGEX, FIELD_VALIDATION_MESSAGES.PHONE_NUMBER))],
  extension: [V.optional(V.matches(EXTENSION_REGEX, FIELD_VALIDATION_MESSAGES.PHONE_EXTENSION))],
};

export const TRUSTEE_ASSISTANT_SPEC: Readonly<ValidationSpec<TrusteeAssistantFormData>> = {
  $: [completedAddressRequired, phoneRequiredWithExtension],
  name: [V.optional(V.minLength(1, 'Trustee name is required'), V.maxLength(50))],
  address1: [
    V.optional(V.minLength(1, FIELD_VALIDATION_MESSAGES.ADDRESS_REQUIRED), V.maxLength(40)),
  ],
  address2: [V.optional(V.maxLength(40))],
  city: [V.optional(V.minLength(1, FIELD_VALIDATION_MESSAGES.CITY_REQUIRED), V.maxLength(50))],
  state: [V.optional(V.exactLength(2, FIELD_VALIDATION_MESSAGES.STATE_REQUIRED))],
  zipCode: [V.optional(V.matches(ZIP_REGEX, FIELD_VALIDATION_MESSAGES.ZIP_CODE))],
  email: [V.optional(V.matches(EMAIL_REGEX, FIELD_VALIDATION_MESSAGES.EMAIL), V.maxLength(50))],
  phone: [V.optional(V.matches(PHONE_REGEX, FIELD_VALIDATION_MESSAGES.PHONE_NUMBER))],
  extension: [V.optional(V.matches(EXTENSION_REGEX, FIELD_VALIDATION_MESSAGES.PHONE_EXTENSION))],
};
