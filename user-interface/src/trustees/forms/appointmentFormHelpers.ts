import { CourtDivisionDetails } from '@common/cams/courts';
import { getDivisionsForDistrict } from '@/lib/utils/court-utils';
import { ALL_DIVISIONS_VALUE } from './useDivisionSelection';

export type CourtDivisionInput = {
  courtId: string;
  divisionCodes: string[];
};

/**
 * Extract court and division information from form data.
 * Expands "All Divisions" synthetic value to actual division codes.
 *
 * @param formData - The form data
 * @param allCourts - All available court divisions (needed for "All Divisions" expansion)
 * @returns {courtId, divisionCodes} or null if required fields are missing
 */
export function extractCourtAndDivisions(
  formData: CourtDivisionInput,
  allCourts: CourtDivisionDetails[],
): { courtId: string; divisionCodes: string[] } | null {
  if (!formData.courtId || formData.divisionCodes.length === 0) {
    return null;
  }

  let divisionCodes = formData.divisionCodes;

  // Expand "All Divisions" synthetic value to actual division codes
  if (divisionCodes.includes(ALL_DIVISIONS_VALUE)) {
    divisionCodes = getDivisionsForDistrict(allCourts, formData.courtId).map(
      (d) => d.courtDivisionCode,
    );
  }

  return {
    courtId: formData.courtId,
    divisionCodes,
  };
}
