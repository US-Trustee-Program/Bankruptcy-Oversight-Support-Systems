import {
  AppointmentChapterType,
  AppointmentStatus,
  AppointmentType,
  TrusteeInput,
} from '@common/cams/trustees';
import {
  TrusteeAppointmentInput,
  chapterAppointmentTypeMap,
} from '@common/cams/trustee-appointments';
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
  MULTI_DISTRICT_COURT_MAP,
  DIVISION_TO_COURT_MAP,
  CBC_STATUS_MAP,
  SUBCHAPTER_V_STATUS_CODES,
  CODE_1_STANDING_CHAPTERS,
} from './ats.constants';

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
    return DEFAULT_STATUS_MAPPING;
  }

  const trimmedStatus = todStatus.trim().toUpperCase();

  if (TOD_STATUS_MAP[trimmedStatus]) {
    return TOD_STATUS_MAP[trimmedStatus];
  }

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
    return 'Unknown';
  }

  return officeName;
}

/**
 * Map district code to DXTR court ID.
 *
 * When a division code is provided, it is used as the primary lookup via
 * DIVISION_TO_COURT_MAP since it maps directly to the correct court.
 * Falls back to district-based resolution (with multi-district disambiguation)
 * when the division code is not recognized.
 *
 * @param districtCode - 2-character ATS district code
 * @param divisionCode - Optional 3-character ATS division code
 * @returns DXTR court ID
 */
export function getCourtId(districtCode: string, divisionCode?: string): string {
  if (!districtCode) {
    throw new Error('District code is required');
  }

  // Primary: resolve courtId directly from division code
  if (divisionCode) {
    const trimmedDivision = divisionCode.trim();
    const divisionCourtId = DIVISION_TO_COURT_MAP[trimmedDivision];
    if (divisionCourtId) {
      return divisionCourtId;
    }
  }

  // Fallback: resolve from district code
  const trimmedDistrict = districtCode.trim();

  // For multi-district states, use division code prefix to disambiguate
  if (divisionCode && MULTI_DISTRICT_COURT_MAP[trimmedDistrict]) {
    const divisionPrefix = divisionCode.trim().substring(0, 2);
    const resolved = MULTI_DISTRICT_COURT_MAP[trimmedDistrict][divisionPrefix];
    if (resolved) {
      return resolved;
    }
  }

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
export function transformTrusteeRecord(
  atsTrustee: AtsTrusteeRecord,
  status?: AppointmentStatus,
): TrusteeInput {
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
    status: status || DEFAULT_TRUSTEE_STATUS,
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
 * Apply special-case overrides for appointment chapter, type, and status.
 * Handles CBC overrides, subchapter-v detection, code-1 standing rules, and legacy CBC types.
 *
 * @param chapterMapping - Parsed chapter mapping from ATS
 * @param originalChapter - Original chapter code (for CBC lookup)
 * @param statusCode - Status code from ATS
 * @param statusMapping - Parsed status mapping from ATS
 * @returns Resolved chapter, appointment type, and status
 */
function applyAppointmentOverrides(
  chapterMapping: ChapterMapping,
  originalChapter: string,
  statusCode: string,
  statusMapping: StatusMapping,
): {
  chapter: AppointmentChapterType;
  appointmentType: AppointmentType;
  status: AppointmentStatus;
} {
  const chapter = chapterMapping.chapter as AppointmentChapterType;
  let appointmentType: AppointmentType = statusMapping.appointmentType;
  const status: AppointmentStatus = statusMapping.status;

  // SPECIAL CASE 1: CBC chapter overrides
  // CBC chapters override BOTH appointmentType and status from flat map
  const cbcOverride = CBC_STATUS_MAP[originalChapter]?.[statusCode];
  if (cbcOverride) {
    return {
      chapter,
      appointmentType: cbcOverride.appointmentType,
      status: cbcOverride.status,
    };
  }

  // SPECIAL CASE 2: V/VR + Chapter 11 → 11-subchapter-v
  // When CHAPTER=11 and STATUS=V or VR, resolve to '11-subchapter-v'
  if (chapter === '11' && SUBCHAPTER_V_STATUS_CODES.has(statusCode)) {
    return { chapter: '11-subchapter-v', appointmentType, status };
  }

  // SPECIAL CASE 3: Code 1 + Chapter 12/13 → Standing/Active
  // Code 1 with Ch12/13 maps to Standing/Active instead of Case-by-Case/Active
  if (statusCode === '1' && CODE_1_STANDING_CHAPTERS.has(chapter)) {
    return { chapter, appointmentType: 'standing', status: 'active' };
  }

  // SPECIAL CASE 4: Legacy CBC appointmentType from chapter parsing
  // If chapter parsing gave us an appointmentType (12CBC/13CBC), use that
  if (chapterMapping.appointmentType) {
    appointmentType = chapterMapping.appointmentType;
  }

  return { chapter, appointmentType, status };
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
  // Keep original chapter code for CBC lookup
  const originalChapter = atsAppointment.CHAPTER?.trim().toUpperCase() || '';
  const statusCode = atsAppointment.STATUS?.trim().toUpperCase() || '';

  // Parse chapter and get appointment type if specified
  const chapterMapping = parseChapterAndType(atsAppointment.CHAPTER);

  // Parse status to get appointment type and status (flat map defaults)
  const statusMapping = parseTodStatus(atsAppointment.STATUS);

  // Apply special-case overrides
  const { chapter, appointmentType, status } = applyAppointmentOverrides(
    chapterMapping,
    originalChapter,
    statusCode,
    statusMapping,
  );

  // Map district to court ID (pass division for multi-district state disambiguation)
  const courtId = getCourtId(atsAppointment.DISTRICT, atsAppointment.DIVISION);

  // Validate chapter type for CAMS
  if (!['7', '11', '11-subchapter-v', '12', '13'].includes(chapter)) {
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
    status,
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
  const validTypes = chapterAppointmentTypeMap[chapter];
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
