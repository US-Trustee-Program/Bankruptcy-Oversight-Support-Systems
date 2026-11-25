import { AtsTrusteeRecord } from '../../adapters/types/ats.types';
import { TrusteeAppointmentInput } from '@common/cams/trustee-appointments';
import { UstpOfficeDetails } from '@common/cams/offices';

// Rules the TOD trustee load (migrate-trustees) and the trustee data report must share, so the
// report rebuilds what the load created. Keep this module free of factory and queue imports.

/**
 * Division information extracted from DXTR offices data
 */
export type DivisionInfo = {
  divisionCode: string;
  courtId: string;
  courtName: string;
  courtDivisionName: string;
};

/**
 * Build a map from district code (courtId) to array of divisions.
 * This allows us to expand ATS district appointments into multiple division-specific appointments.
 *
 * @param offices - Array of USTP office details from DXTR
 * @returns Map of district code → divisions
 */
export function buildDistrictToDivisionsMap(
  offices: UstpOfficeDetails[],
): Map<string, DivisionInfo[]> {
  const districtMap = new Map<string, DivisionInfo[]>();

  for (const office of offices) {
    for (const group of office.groups) {
      for (const division of group.divisions) {
        const courtId = division.court.courtId;
        const divisionInfo: DivisionInfo = {
          divisionCode: division.divisionCode,
          courtId,
          courtName: division.court.courtName,
          courtDivisionName: division.courtOffice.courtOfficeName,
        };

        if (!districtMap.has(courtId)) {
          districtMap.set(courtId, []);
        }

        districtMap.get(courtId)!.push(divisionInfo);
      }
    }
  }

  return districtMap;
}

/**
 * Create a unique key for an appointment to prevent duplicates.
 * Key format: trusteeId-courtId-chapter-appointmentType (one appointment per district)
 */
export function getAppointmentKey(trusteeId: string, appointment: TrusteeAppointmentInput): string {
  return `${trusteeId}-${appointment.courtId}-${appointment.chapter}-${appointment.appointmentType}`;
}

/**
 * Calculate address completeness score for an ATS trustee record.
 * Counts non-null/non-empty address fields.
 *
 * @param atsTrustee - ATS trustee record
 * @returns Completeness score (higher is more complete)
 */
function calculateAddressScore(atsTrustee: AtsTrusteeRecord): number {
  let score = 0;

  if (atsTrustee.STREET) score++;
  if (atsTrustee.STREET1) score++;
  if (atsTrustee.CITY) score++;
  if (atsTrustee.STATE) score++;
  if (atsTrustee.ZIP) score++;
  if (atsTrustee.ZIP_PLUS) score++;
  if (atsTrustee.TELEPHONE) score++;
  if (atsTrustee.EMAIL_ADDRESS) score++;
  if (atsTrustee.COMPANY) score++;

  return score;
}

/**
 * Select the primary record from multiple trustee records based on address completeness.
 * Chooses the record with the most complete address data.
 * Uses ID as a tiebreaker for consistent selection.
 *
 * @param records - Array of ATS trustee records (same person, different TOD IDs)
 * @returns Primary record with the most complete address
 */
export function selectPrimaryRecord(records: AtsTrusteeRecord[]): AtsTrusteeRecord {
  if (records.length === 0) {
    throw new Error('Cannot select primary record from empty array');
  }

  if (records.length === 1) {
    return records[0];
  }

  // Score each record and select the one with highest score
  const scoredRecords = records.map((record) => ({
    record,
    score: calculateAddressScore(record),
  }));

  // Sort by score descending (highest first), then by ID ascending for consistency
  scoredRecords.sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }
    return a.record.ID - b.record.ID;
  });

  return scoredRecords[0].record;
}
