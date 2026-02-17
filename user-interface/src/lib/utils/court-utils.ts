import { usStates } from '@common/cams/us-states';

/**
 * Maps a 2-letter state code to its full state name for sorting purposes.
 *
 * Examples:
 * - "NY" → "New York"
 * - "CA" → "California"
 * - "DC" → "District of Columbia"
 *
 * This mapping is necessary because sorting by 2-letter codes produces
 * incorrect alphabetical order (e.g., "NV" before "NY" instead of
 * "Nevada" before "New York").
 *
 * @param stateCode - The 2-letter state code (e.g., "NY")
 * @returns The full state name, or the original code if not found
 */
export function getStateNameFromCode(stateCode: string): string {
  const state = usStates.find((s) => s.code === stateCode);
  return state ? state.name : stateCode;
}

/**
 * Extracts numeric chapter value for sorting.
 * Examples: '7' → 7, '11' → 11, '11-subchapter-v' → 11
 */
function getChapterNumber(chapter: string): number {
  const match = chapter.match(/^(\d+)/);
  return match ? parseInt(match[1], 10) : 0;
}

/**
 * Item with court location properties for sorting.
 * Properties are optional to support types like TrusteeAppointment where they may be undefined.
 */
interface CourtLocationSortable {
  state?: string;
  courtName?: string;
  courtDivisionName?: string;
  chapter?: string;
  appointmentType?: string;
}

interface SortOptions {
  includeAppointmentDetails?: boolean;
}

/**
 * Sorts items by court location: state → court name → division name.
 * Optionally includes chapter and appointment type sorting for appointments.
 *
 * Sort order:
 * 1. State name (from state code, mapped to full name) - alphabetically
 * 2. Court name - alphabetically within state
 * 3. Division name - alphabetically within court
 * 4. Chapter number - ascending (only if includeAppointmentDetails: true)
 * 5. Appointment type - alphabetically (only if includeAppointmentDetails: true)
 *
 * @param items - Array of items with state, courtName and courtDivisionName
 * @param options - Optional settings
 * @param options.includeAppointmentDetails - If true, also sorts by chapter and appointmentType
 * @returns New sorted array (does not mutate original)
 */
export function sortByCourtLocation<T extends CourtLocationSortable>(
  items: T[],
  options?: SortOptions,
): T[] {
  return [...items].sort((a, b) => {
    // 1. Sort by state name (mapped from state code to full name)
    const stateA = getStateNameFromCode(a.state || '');
    const stateB = getStateNameFromCode(b.state || '');
    const stateComparison = stateA.localeCompare(stateB);
    if (stateComparison !== 0) return stateComparison;

    // 2. Sort by court name within state
    const courtComparison = (a.courtName || '').localeCompare(b.courtName || '');
    if (courtComparison !== 0) return courtComparison;

    // 3. Sort by division name within court
    const divisionComparison = (a.courtDivisionName || '').localeCompare(b.courtDivisionName || '');
    if (divisionComparison !== 0) return divisionComparison;

    // 4-5. Optional: sort by chapter and appointment type
    if (options?.includeAppointmentDetails) {
      if (a.chapter && b.chapter) {
        const chapterComparison = getChapterNumber(a.chapter) - getChapterNumber(b.chapter);
        if (chapterComparison !== 0) return chapterComparison;
      }

      if (a.appointmentType && b.appointmentType) {
        return a.appointmentType.localeCompare(b.appointmentType);
      }
    }

    return 0;
  });
}
