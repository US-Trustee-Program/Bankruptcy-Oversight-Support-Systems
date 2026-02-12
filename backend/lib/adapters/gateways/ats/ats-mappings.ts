import {
  AppointmentChapterType,
  AppointmentStatus,
  AppointmentType,
  TrusteeInput,
  TrusteeStatuses,
  TrusteeStatus,
} from '@common/cams/trustees';
import { TrusteeAppointmentInput } from '@common/cams/trustee-appointments';
import { ContactInformation } from '@common/cams/contact';
import { USTP_OFFICE_NAME_MAP } from '../dxtr/dxtr.constants';
import {
  AtsTrusteeRecord,
  AtsAppointmentRecord,
  StatusMapping,
  ChapterMapping,
} from '../../types/ats.types';
import {
  TOD_STATUS_MAP,
  DEFAULT_STATUS_MAPPING,
  DEFAULT_TRUSTEE_STATUS,
  SPECIAL_CHAPTER_CODES,
  STANDARD_CHAPTERS,
  DISTRICT_TO_COURT_MAP,
} from './ats.constants';

const MODULE_NAME = 'ATS-MAPPINGS';

/**
 * Parse chapter code from ATS, handling special case-by-case codes.
 *
 * @param todChapter - Chapter code from ATS (e.g., '7', '13', '12CBC')
 * @returns Chapter and optional appointment type
 */
export function parseChapterAndType(todChapter: string): ChapterMapping {
  if (!todChapter) {
    throw new Error('Chapter code is required');
  }

  const trimmedChapter = todChapter.trim().toUpperCase();

  // Check for special case-by-case chapters
  if (SPECIAL_CHAPTER_CODES[trimmedChapter]) {
    return SPECIAL_CHAPTER_CODES[trimmedChapter];
  }

  // Standard chapters - remove any leading zeros
  const numericChapter = trimmedChapter.replace(/^0+/, '');

  if (!STANDARD_CHAPTERS.includes(numericChapter)) {
    throw new Error(`Unknown chapter code: ${todChapter}`);
  }

  return { chapter: numericChapter };
}

/**
 * Parse TOD STATUS to determine appointment type and status.
 *
 * @param todStatus - Status code from ATS
 * @returns Appointment type and status
 */
export function parseTodStatus(todStatus: string): StatusMapping {
  if (!todStatus) {
    console.warn(`${MODULE_NAME}: Empty TOD STATUS, using defaults`);
    return DEFAULT_STATUS_MAPPING;
  }

  const trimmedStatus = todStatus.trim().toUpperCase();

  // Check if we have a mapping for this status
  if (TOD_STATUS_MAP[trimmedStatus]) {
    return TOD_STATUS_MAP[trimmedStatus];
  }

  // Log unknown status and return default
  console.warn(`${MODULE_NAME}: Unknown TOD STATUS '${todStatus}', using defaults`);
  return DEFAULT_STATUS_MAPPING;
}

/**
 * Map division code to office name using existing USTP mapping.
 *
 * @param divisionCode - 3-character division code
 * @returns Office name or 'Unknown' if not found
 */
export function getDivisionOfficeName(divisionCode: string): string {
  if (!divisionCode) {
    return 'Unknown';
  }

  const trimmedCode = divisionCode.trim();
  const officeName = USTP_OFFICE_NAME_MAP.get(trimmedCode);

  if (!officeName) {
    console.warn(`${MODULE_NAME}: Unknown division code '${divisionCode}'`);
    return 'Unknown';
  }

  return officeName;
}

/**
 * Map district code to court ID.
 *
 * @param districtCode - 2-character district code
 * @returns Court ID
 */
export function getCourtId(districtCode: string): string {
  if (!districtCode) {
    throw new Error('District code is required');
  }

  const trimmedDistrict = districtCode.trim();
  const courtId = DISTRICT_TO_COURT_MAP[trimmedDistrict];

  if (!courtId) {
    throw new Error(`Unknown district code: ${districtCode}`);
  }

  return courtId;
}

/**
 * Format phone number to standard format.
 *
 * @param phone - Raw phone number
 * @returns Formatted phone number or undefined
 */
export function formatPhoneNumber(phone: string | undefined): string | undefined {
  if (!phone) return undefined;

  // Remove all non-numeric characters
  const cleaned = phone.replace(/\D/g, '');

  // Check if it's a valid US phone number
  if (cleaned.length === 10) {
    return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
  } else if (cleaned.length === 11 && cleaned[0] === '1') {
    // Remove country code
    return `${cleaned.slice(1, 4)}-${cleaned.slice(4, 7)}-${cleaned.slice(7)}`;
  }

  // Return original if can't format
  return phone;
}

/**
 * Format ZIP code to standard format (ZIP+4).
 *
 * @param zip - Raw ZIP code
 * @param zipPlus - Optional ZIP+4 extension
 * @returns Formatted ZIP code or undefined
 */
export function formatZipCode(
  zip: string | undefined,
  zipPlus?: string | undefined,
): string | undefined {
  if (!zip) return undefined;

  // Remove all non-alphanumeric characters from zip
  const cleanedZip = zip.replace(/[^0-9]/g, '');

  if (cleanedZip.length !== 5) {
    // If main ZIP is not 5 digits, try to extract from a 9-digit format
    if (cleanedZip.length === 9) {
      return `${cleanedZip.slice(0, 5)}-${cleanedZip.slice(5)}`;
    }
    return zip; // Return original if can't format
  }

  // If we have a separate ZIP+4 extension
  if (zipPlus) {
    const cleanedPlus = zipPlus.replace(/[^0-9]/g, '');
    if (cleanedPlus.length === 4) {
      return `${cleanedZip}-${cleanedPlus}`;
    }
  }

  return cleanedZip;
}

/**
 * Transform ATS trustee record to CAMS trustee input format.
 *
 * @param atsTrustee - Raw trustee record from ATS
 * @returns Trustee input for CAMS
 */
export function transformTrusteeRecord(atsTrustee: AtsTrusteeRecord): TrusteeInput {
  // Build full name string
  const nameParts = [];
  if (atsTrustee.FIRST_NAME) nameParts.push(atsTrustee.FIRST_NAME);
  if (atsTrustee.MIDDLE) nameParts.push(atsTrustee.MIDDLE);
  if (atsTrustee.LAST_NAME) nameParts.push(atsTrustee.LAST_NAME);

  const fullName = nameParts.join(' ') || 'Unknown';

  // Build public contact information
  const publicContact: ContactInformation = {
    address: {
      address1: atsTrustee.STREET || '',
      address2: atsTrustee.STREET1,
      city: atsTrustee.CITY || '',
      state: atsTrustee.STATE || '',
      zipCode: formatZipCode(atsTrustee.ZIP, atsTrustee.ZIP_PLUS) || '',
      countryCode: 'US' as const,
    },
  };

  // Add phone if present
  const formattedPhone = formatPhoneNumber(atsTrustee.TELEPHONE);
  if (formattedPhone) {
    publicContact.phone = { number: formattedPhone };
  }

  // Add email if present
  if (atsTrustee.EMAIL_ADDRESS) {
    publicContact.email = atsTrustee.EMAIL_ADDRESS;
  }

  // Add company name if present
  if (atsTrustee.COMPANY) {
    publicContact.companyName = atsTrustee.COMPANY;
  }

  const trusteeInput: TrusteeInput = {
    name: fullName,
    status: DEFAULT_TRUSTEE_STATUS,
    public: publicContact,
    legacy: {
      truId: atsTrustee.ID.toString(),
    },
  };

  // Build internal contact information if any A2 fields are present
  if (atsTrustee.STREET_A2 || atsTrustee.CITY_A2 || atsTrustee.STATE_A2 || atsTrustee.ZIP_A2) {
    const internalContact: ContactInformation = {
      address: {
        address1: atsTrustee.STREET_A2 || '',
        address2: atsTrustee.STREET1_A2,
        city: atsTrustee.CITY_A2 || '',
        state: atsTrustee.STATE_A2 || '',
        zipCode: formatZipCode(atsTrustee.ZIP_A2, atsTrustee.ZIP_PLUS_A2) || '',
        countryCode: 'US' as const,
      },
    };

    // Internal contact uses same phone and email as public for now
    if (formattedPhone) {
      internalContact.phone = { number: formattedPhone };
    }
    if (atsTrustee.EMAIL_ADDRESS) {
      internalContact.email = atsTrustee.EMAIL_ADDRESS;
    }

    trusteeInput.internal = internalContact;
  }

  return trusteeInput;
}

/**
 * Transform ATS appointment record to CAMS appointment input format.
 *
 * @param atsAppointment - Raw appointment record from ATS
 * @returns Appointment input for CAMS
 */
export function transformAppointmentRecord(
  atsAppointment: AtsAppointmentRecord,
): TrusteeAppointmentInput {
  // Parse chapter and get appointment type if specified
  const chapterMapping = parseChapterAndType(atsAppointment.CHAPTER);

  // Parse status to get appointment type and status
  // If chapter already specified appointment type (like 12CBC), use that
  const statusMapping = parseTodStatus(atsAppointment.STATUS);
  const appointmentType = chapterMapping.appointmentType || statusMapping.appointmentType;

  // Map district to court ID
  const courtId = getCourtId(atsAppointment.DISTRICT);

  // Validate chapter type for CAMS
  const chapter = chapterMapping.chapter as AppointmentChapterType;
  if (!['7', '11', '12', '13'].includes(chapter)) {
    throw new Error(`Invalid chapter for CAMS: ${chapter}`);
  }

  // Format dates
  const appointedDate = atsAppointment.DATE_APPOINTED
    ? atsAppointment.DATE_APPOINTED.toISOString().split('T')[0]
    : new Date().toISOString().split('T')[0];

  const effectiveDate = atsAppointment.EFFECTIVE_DATE
    ? atsAppointment.EFFECTIVE_DATE.toISOString().split('T')[0]
    : appointedDate;

  return {
    chapter,
    appointmentType,
    courtId,
    divisionCode: atsAppointment.DIVISION,
    appointedDate,
    status: statusMapping.status,
    effectiveDate,
  };
}

/**
 * Validate that appointment type is valid for the chapter.
 *
 * @param chapter - Chapter type
 * @param appointmentType - Appointment type
 * @returns True if valid combination
 */
export function isValidAppointmentForChapter(
  chapter: AppointmentChapterType,
  appointmentType: AppointmentType,
): boolean {
  const validCombinations: Record<AppointmentChapterType, AppointmentType[]> = {
    '7': ['panel', 'off-panel', 'elected', 'converted-case'],
    '11': ['case-by-case'],
    '11-subchapter-v': ['pool', 'out-of-pool'],
    '12': ['standing', 'case-by-case'],
    '13': ['standing', 'case-by-case'],
  };

  const validTypes = validCombinations[chapter];
  return validTypes ? validTypes.includes(appointmentType) : false;
}

/**
 * Create a unique key for an appointment to prevent duplicates.
 *
 * @param trusteeId - Trustee ID
 * @param appointment - Appointment data
 * @returns Unique key string
 */
export function getAppointmentKey(trusteeId: string, appointment: TrusteeAppointmentInput): string {
  return `${trusteeId}-${appointment.courtId}-${appointment.divisionCode}-${appointment.chapter}-${appointment.appointmentType}`;
}

/**
 * Derive trustee-level status from their appointment statuses.
 *
 * Priority:
 * 1. If any appointment is 'active', trustee is ACTIVE
 * 2. If any appointment is suspended, trustee is SUSPENDED
 * 3. Otherwise, trustee is NOT_ACTIVE
 *
 * Returns ACTIVE when there are no appointments (default).
 *
 * @param appointmentStatuses - Statuses from all of a trustee's appointments
 * @returns Derived trustee status
 */
export function deriveTrusteeStatus(appointmentStatuses: AppointmentStatus[]): TrusteeStatus {
  if (appointmentStatuses.length === 0) {
    return TrusteeStatuses.ACTIVE;
  }

  if (appointmentStatuses.some((s) => s === 'active')) {
    return TrusteeStatuses.ACTIVE;
  }

  if (
    appointmentStatuses.some(
      (s) => s === 'voluntarily-suspended' || s === 'involuntarily-suspended',
    )
  ) {
    return TrusteeStatuses.SUSPENDED;
  }

  return TrusteeStatuses.NOT_ACTIVE;
}
