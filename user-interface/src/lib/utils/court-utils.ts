/**
 * Extracts state name from court name patterns for sorting purposes.
 *
 * Examples:
 * - "Southern District of New York" → "New York"
 * - "District of Columbia" → "Columbia"
 * - "District of Idaho" → "Idaho"
 * - "Northern District of Iowa" → "Iowa"
 *
 * This extraction is necessary because court names have varying prefixes
 * (Northern, Southern, Eastern, Western, Central, District of) that would
 * cause incorrect alphabetical sorting if sorted by the full court name.
 *
 * @param courtName - The full court name (e.g., "Southern District of New York")
 * @returns The extracted state name, or the original string if pattern doesn't match
 */
export function getStateFromCourtName(courtName: string): string {
  const match = courtName.match(/District of (.+)$/i);
  return match ? match[1] : courtName;
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
 * 1. State name (extracted from courtName) - alphabetically
 * 2. Court name - alphabetically within state
 * 3. Division name - alphabetically within court
 * 4. Chapter number - ascending (only if includeAppointmentDetails: true)
 * 5. Appointment type - alphabetically (only if includeAppointmentDetails: true)
 *
 * @param items - Array of items with courtName and courtDivisionName
 * @param options - Optional settings
 * @param options.includeAppointmentDetails - If true, also sorts by chapter and appointmentType
 * @returns New sorted array (does not mutate original)
 */
export function sortByCourtLocation<T extends CourtLocationSortable>(
  items: T[],
  options?: SortOptions,
): T[] {
  return [...items].sort((a, b) => {
    // 1. Sort by state name (extracted from courtName)
    const stateA = getStateFromCourtName(a.courtName || '');
    const stateB = getStateFromCourtName(b.courtName || '');
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
