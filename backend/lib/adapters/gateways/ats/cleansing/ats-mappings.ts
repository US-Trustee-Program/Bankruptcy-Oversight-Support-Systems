import {
  AppointmentChapterType,
  AppointmentStatus,
  AppointmentType,
  TrusteeInput,
  computeTrusteeName,
} from '@common/cams/trustees';
import { TrusteeAppointmentInput } from '@common/cams/trustee-appointments';
import { ContactInformation } from '@common/cams/contact';
import { parseYesNo } from '@common/string-helper';
import { USTP_OFFICE_NAME_MAP } from '../../dxtr/dxtr.constants';
import {
  AtsTrusteeRecord,
  AtsAppointmentRecord,
  StatusMapping,
  ChapterMapping,
} from '../../../types/ats.types';
import {
  TOD_STATUS_MAP,
  DEFAULT_STATUS_MAPPING,
  DEFAULT_TRUSTEE_STATUS,
  SPECIAL_CHAPTER_CODES,
  STANDARD_CHAPTERS,
  DISTRICT_TO_COURT_MAP,
  CBC_STATUS_MAP,
  SUBCHAPTER_V_STATUS_CODES,
  CODE_1_STANDING_CHAPTERS,
} from '../ats.constants';

/**
 * Parse chapter code from ATS, handling special case-by-case codes.
 *
 * @param todChapter - Chapter code from ATS (e.g., '7', '13', '12CBC')
 * @returns Chapter and optional appointment type
 */
export function parseChapterAndType(todChapter: string | undefined): ChapterMapping {
  if (!todChapter) {
    throw new Error('Chapter code is required');
  }

  const trimmedChapter = todChapter.trim().toUpperCase();

  // Check for special case-by-case chapters
  if (SPECIAL_CHAPTER_CODES[trimmedChapter as keyof typeof SPECIAL_CHAPTER_CODES]) {
    return SPECIAL_CHAPTER_CODES[
      trimmedChapter as keyof typeof SPECIAL_CHAPTER_CODES
    ] as ChapterMapping;
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
 * @param districtCode - 2-character ATS district code
 * @returns DXTR court ID
 */
function getCourtId(districtCode: string): string {
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

export type AmbiguousFlagTrustee = {
  trusteeId: number;
  name: string;
  dispOnWeb: string | undefined;
  dispOnWebA2: string | undefined;
  address: { street?: string; city?: string; state?: string; zip?: string };
  addressA2: { street?: string; city?: string; state?: string; zip?: string };
};

export function detectAmbiguousFlagTrustees(trustees: AtsTrusteeRecord[]): AmbiguousFlagTrustee[] {
  const ambiguous: AmbiguousFlagTrustee[] = [];

  for (const t of trustees) {
    const dispOnWeb = parseYesNo(t.DISP_ON_WEB);
    const dispOnWebA2 = parseYesNo(t.DISP_ON_WEB_A2);

    const unexpectedDispOnWeb =
      t.DISP_ON_WEB !== undefined &&
      t.DISP_ON_WEB !== null &&
      t.DISP_ON_WEB.trim() !== '' &&
      dispOnWeb === undefined;
    const unexpectedDispOnWebA2 =
      t.DISP_ON_WEB_A2 !== undefined &&
      t.DISP_ON_WEB_A2 !== null &&
      t.DISP_ON_WEB_A2.trim() !== '' &&
      dispOnWebA2 === undefined;

    const bothSame = dispOnWeb === dispOnWebA2 && (dispOnWeb === 'y' || dispOnWeb === 'n');

    if (!bothSame && !unexpectedDispOnWeb && !unexpectedDispOnWebA2) continue;

    const firstName = t.FIRST_NAME?.trim() || '';
    const lastName = t.LAST_NAME?.trim() || '';
    const name = [firstName, lastName].filter(Boolean).join(' ') || 'Unknown';

    ambiguous.push({
      trusteeId: t.ID,
      name,
      dispOnWeb: t.DISP_ON_WEB,
      dispOnWebA2: t.DISP_ON_WEB_A2,
      address: { street: t.STREET, city: t.CITY, state: t.STATE, zip: t.ZIP },
      addressA2: { street: t.STREET_A2, city: t.CITY_A2, state: t.STATE_A2, zip: t.ZIP_A2 },
    });
  }

  return ambiguous;
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
  // Build separate name fields from ATS source
  const firstName = atsTrustee.FIRST_NAME?.trim() || '';
  const lastName = atsTrustee.LAST_NAME?.trim() || '';
  const middleName = atsTrustee.MIDDLE?.trim() || undefined;

  const computedName = computeTrusteeName(firstName, middleName, lastName);
  const fullName = computedName || 'Unknown';

  const dispOnWeb = parseYesNo(atsTrustee.DISP_ON_WEB);
  const dispOnWebA2 = parseYesNo(atsTrustee.DISP_ON_WEB_A2);
  // When both flags are 'y' (ambiguous), a2IsPublic is false: default to non-A2 as public.
  // Ambiguous records are separately captured by detectAmbiguousFlagTrustees for manual review.
  const a2IsPublic = dispOnWebA2 === 'y' && dispOnWeb !== 'y';

  // Assign address fields to public/internal based on display flags.
  // When DISP_ON_WEB_A2='y' (and DISP_ON_WEB is not also 'y'), A2 fields are the public address.
  const primaryStreet = a2IsPublic ? atsTrustee.STREET_A2 : atsTrustee.STREET;
  const primaryStreet1 = a2IsPublic ? atsTrustee.STREET1_A2 : atsTrustee.STREET1;
  const primaryCity = a2IsPublic ? atsTrustee.CITY_A2 : atsTrustee.CITY;
  const primaryState = a2IsPublic ? atsTrustee.STATE_A2 : atsTrustee.STATE;
  const primaryZip = a2IsPublic ? atsTrustee.ZIP_A2 : atsTrustee.ZIP;
  const primaryZipPlus = a2IsPublic ? atsTrustee.ZIP_PLUS_A2 : atsTrustee.ZIP_PLUS;

  const secondaryStreet = a2IsPublic ? atsTrustee.STREET : atsTrustee.STREET_A2;
  const secondaryStreet1 = a2IsPublic ? atsTrustee.STREET1 : atsTrustee.STREET1_A2;
  const secondaryCity = a2IsPublic ? atsTrustee.CITY : atsTrustee.CITY_A2;
  const secondaryState = a2IsPublic ? atsTrustee.STATE : atsTrustee.STATE_A2;
  const secondaryZip = a2IsPublic ? atsTrustee.ZIP : atsTrustee.ZIP_A2;
  const secondaryZipPlus = a2IsPublic ? atsTrustee.ZIP_PLUS : atsTrustee.ZIP_PLUS_A2;

  // Build public contact information
  const publicContact: ContactInformation = {
    address: {
      address1: primaryStreet || '',
      address2: primaryStreet1 || undefined,
      city: primaryCity || '',
      state: primaryState || '',
      zipCode: formatZipCode(primaryZip, primaryZipPlus) || '',
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
    firstName,
    lastName,
    middleName,
    name: fullName,
    status: status || DEFAULT_TRUSTEE_STATUS,
    public: publicContact,
    legacy: {
      truIds: [atsTrustee.ID.toString()],
    },
  };

  // Build internal contact information if any secondary address fields are present
  if (secondaryStreet || secondaryCity || secondaryState || secondaryZip) {
    const internalContact: ContactInformation = {
      address: {
        address1: secondaryStreet || '',
        address2: secondaryStreet1 || undefined,
        city: secondaryCity || '',
        state: secondaryState || '',
        zipCode: formatZipCode(secondaryZip, secondaryZipPlus) || '',
        countryCode: 'US' as const,
      },
    };

    // Internal contact uses same phone and email as public
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
export function applyAppointmentOverrides(
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
  const statusMapping = parseTodStatus(atsAppointment.STATUS ?? '');

  // Apply special-case overrides
  const { chapter, appointmentType, status } = applyAppointmentOverrides(
    chapterMapping,
    originalChapter,
    statusCode,
    statusMapping,
  );

  // Map district to court ID
  const courtId = getCourtId(atsAppointment.DISTRICT);

  // Validate chapter type for CAMS
  if (!['7', '11', '11-subchapter-v', '12', '13'].includes(chapter)) {
    throw new Error(`Invalid chapter for CAMS: ${chapter}`);
  }

  // Format dates
  if (!atsAppointment.DATE_APPOINTED) {
    throw new Error('DATE_APPOINTED is required');
  }
  const appointedDate = atsAppointment.DATE_APPOINTED.toISOString().split('T')[0];

  const effectiveDate = atsAppointment.EFFECTIVE_DATE
    ? atsAppointment.EFFECTIVE_DATE.toISOString().split('T')[0]
    : appointedDate;

  return {
    chapter,
    appointmentType,
    courtId,
    appointedDate,
    status,
    effectiveDate,
  };
}
