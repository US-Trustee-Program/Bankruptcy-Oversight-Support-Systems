import { usStates } from '@common/cams/us-states';
import { CourtDivisionDetails } from '@common/cams/courts';
import { TrusteeAppointment } from '@common/cams/trustee-appointments';

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

/**
 * Groups divisions by district (court name).
 *
 * Multiple divisions can belong to the same district court. For example,
 * "Southern District of New York" has Manhattan (081) and White Plains (087) divisions.
 * This function groups all divisions under their parent district.
 *
 * @param divisions - Array of court division details
 * @returns Map where key is courtName and value is array of all divisions in that district
 *
 * @example
 * const divisions = [
 *   { courtName: "Southern District of New York", courtDivisionCode: "081", ... },
 *   { courtName: "Southern District of New York", courtDivisionCode: "087", ... },
 *   { courtName: "District of Vermont", courtDivisionCode: "088", ... }
 * ];
 * const grouped = groupDivisionsByDistrict(divisions);
 * // Map {
 * //   "Southern District of New York" => [{ code: "081", ... }, { code: "087", ... }],
 * //   "District of Vermont" => [{ code: "088", ... }]
 * // }
 */
export function groupDivisionsByDistrict(
  divisions: CourtDivisionDetails[],
): Map<string, CourtDivisionDetails[]> {
  const districtMap = new Map<string, CourtDivisionDetails[]>();
  divisions.forEach((division) => {
    const key = division.courtName;
    if (!districtMap.has(key)) {
      districtMap.set(key, []);
    }
    districtMap.get(key)!.push(division);
  });
  return districtMap;
}

/**
 * Separates ComboBox options into defaults and non-defaults with proper accessibility markup.
 *
 * User default options are placed first in the list, marked with `isAriaDefault: true` for
 * screen readers, and separated from other options with a visual divider on the last default.
 *
 * @param allOptions - All available ComboBox options
 * @param defaultValues - Set of values that should be treated as defaults
 * @returns Ordered array with defaults first (marked and divided), then non-defaults
 *
 * @example
 * const options = [
 *   { value: "081", label: "Southern District of NY" },
 *   { value: "088", label: "District of Vermont" },
 *   { value: "089", label: "Eastern District of CA" }
 * ];
 * const defaults = new Set(["081", "088"]);
 * const result = separateDefaultOptions(options, defaults);
 * // [
 * //   { value: "081", label: "...", isAriaDefault: true, divider: false },
 * //   { value: "088", label: "...", isAriaDefault: true, divider: true },  ← divider
 * //   { value: "089", label: "..." }
 * // ]
 */
export function separateDefaultOptions(
  allOptions: { value: string; label: string; [key: string]: unknown }[],
  defaultValues: Set<string>,
): {
  value: string;
  label: string;
  isAriaDefault?: boolean;
  divider?: boolean;
  [key: string]: unknown;
}[] {
  // Check if option's value (which may be comma-separated codes) contains any default code
  const isDefault = (opt: { value: string; [key: string]: unknown }) => {
    const codes = opt.value.split(',');
    return codes.some((code) => defaultValues.has(code));
  };

  const defaults = allOptions.filter(isDefault);
  const nonDefaults = allOptions.filter((opt) => !isDefault(opt));

  // Mark defaults and add divider to last one if non-defaults exist
  const markedDefaults = defaults.map((opt, i) => ({
    ...opt,
    isAriaDefault: true,
    divider: i === defaults.length - 1 && nonDefaults.length > 0,
  }));

  return [...markedDefaults, ...nonDefaults];
}

/**
 * Parses state and region from district court name.
 *
 * @param courtName - Full district court name
 * @returns Object with state and region components
 *
 * @example
 * parseDistrictName("Southern District of New York")
 * // { state: "New York", region: "Southern" }
 *
 * parseDistrictName("District of Vermont")
 * // { state: "Vermont", region: "" }
 */
function parseDistrictName(courtName: string): { state: string; region: string } {
  // Extract state: everything after "District of " or use entire name as fallback
  const districtOfMatch = courtName.match(/District of (.+)$/i);
  const state = districtOfMatch ? districtOfMatch[1] : courtName;

  // Extract region: everything before "District of" (e.g., "Southern", "Eastern", "Western", "Northern")
  const regionMatch = courtName.match(/^(.+?)\s+District of/i);
  const region = regionMatch ? regionMatch[1] : '';

  return { state, region };
}

/**
 * Sorts trustee appointments by state, region, chapter, and appointment type.
 *
 * Since TrusteeAppointment doesn't include a state field, this function parses
 * the state and region from the courtName before sorting.
 *
 * Sort order:
 * 1. State name - alphabetically (parsed from courtName)
 * 2. Region - alphabetically (Eastern, Northern, Southern, Western, etc.)
 * 3. Chapter number - ascending (7, 11, 13, etc.)
 * 4. Appointment type - alphabetically
 *
 * @param appointments - Array of trustee appointments to sort
 * @returns New sorted array (does not mutate original)
 *
 * @example
 * const sorted = sortTrusteeAppointments([
 *   { courtName: "Southern District of New York", chapter: "13", ... },
 *   { courtName: "Western District of Kentucky", chapter: "7", ... }
 * ]);
 * // Kentucky comes before New York, then sorted by chapter within each district
 */
export function sortTrusteeAppointments(appointments: TrusteeAppointment[]): TrusteeAppointment[] {
  return [...appointments]
    .map((appt) => {
      const parsed = parseDistrictName(appt.courtName ?? appt.courtId ?? '');
      return {
        appointment: appt,
        state: parsed.state,
        region: parsed.region,
      };
    })
    .sort((a, b) => {
      // 1. Sort by state name alphabetically
      const stateComparison = a.state.localeCompare(b.state, undefined, { sensitivity: 'base' });
      if (stateComparison !== 0) return stateComparison;

      // 2. Sort by region (Eastern, Northern, Southern, Western, etc.)
      const regionComparison = a.region.localeCompare(b.region, undefined, {
        sensitivity: 'base',
      });
      if (regionComparison !== 0) return regionComparison;

      // 3. Sort by chapter number
      const chapterA = a.appointment.chapter ?? '';
      const chapterB = b.appointment.chapter ?? '';
      const chapterComparison = getChapterNumber(chapterA) - getChapterNumber(chapterB);
      if (chapterComparison !== 0) return chapterComparison;

      // 4. Sort by appointment type
      const typeA = a.appointment.appointmentType ?? '';
      const typeB = b.appointment.appointmentType ?? '';
      return typeA.localeCompare(typeB, undefined, { sensitivity: 'base' });
    })
    .map((wrapper) => wrapper.appointment);
}
