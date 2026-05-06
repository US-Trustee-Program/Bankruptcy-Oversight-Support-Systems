import { usStates } from '@common/cams/us-states';
import { CourtDivisionDetails } from '@common/cams/courts';
import { TrusteeAppointment } from '@common/cams/trustee-appointments';
import { caseInsensitiveCompare } from '@common/string-helper';

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
 * Compare function for sorting by state name (from code) then court name.
 * Use with Array.sort() for consistent state+court ordering across the application.
 *
 * @param a - First item with state and courtName properties
 * @param b - Second item with state and courtName properties
 * @returns Negative if a < b, positive if a > b, 0 if equal
 */
function compareByStateAndCourt<T extends { state?: string; courtName?: string }>(
  a: T,
  b: T,
): number {
  // Sort by state name (mapped from code to full name)
  const stateA = getStateNameFromCode(a.state || '');
  const stateB = getStateNameFromCode(b.state || '');
  const stateComparison = stateA.localeCompare(stateB);
  if (stateComparison !== 0) return stateComparison;

  // Sort by court name within state
  return (a.courtName || '').localeCompare(b.courtName || '');
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
    // 1-2. Sort by state name then court name
    const locationComparison = compareByStateAndCourt(a, b);
    if (locationComparison !== 0) return locationComparison;

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
 * @returns Map where key is courtId and value is array of all divisions in that district
 *
 * @example
 * const divisions = [
 *   { courtId: "NYSB", courtName: "Southern District of New York", courtDivisionCode: "081", ... },
 *   { courtId: "NYSB", courtName: "Southern District of New York", courtDivisionCode: "087", ... },
 *   { courtId: "VTB", courtName: "District of Vermont", courtDivisionCode: "088", ... }
 * ];
 * const grouped = groupDivisionsByDistrict(divisions);
 * // Map {
 * //   "NYSB" => [{ code: "081", ... }, { code: "087", ... }],
 * //   "VTB" => [{ code: "088", ... }]
 * // }
 */
export function groupDivisionsByDistrict(
  divisions: CourtDivisionDetails[],
): Map<string, CourtDivisionDetails[]> {
  const districtMap = new Map<string, CourtDivisionDetails[]>();
  divisions.forEach((division) => {
    const key = division.courtId;
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
      const stateComparison = caseInsensitiveCompare(a.state, b.state);
      if (stateComparison !== 0) return stateComparison;

      // 2. Sort by region (Eastern, Northern, Southern, Western, etc.)
      const regionComparison = caseInsensitiveCompare(a.region, b.region);
      if (regionComparison !== 0) return regionComparison;

      // 3. Sort by chapter number
      const chapterA = a.appointment.chapter ?? '';
      const chapterB = b.appointment.chapter ?? '';
      const chapterComparison = getChapterNumber(chapterA) - getChapterNumber(chapterB);
      if (chapterComparison !== 0) return chapterComparison;

      // 4. Sort by appointment type
      const typeA = a.appointment.appointmentType ?? '';
      const typeB = b.appointment.appointmentType ?? '';
      return caseInsensitiveCompare(typeA, typeB);
    })
    .map((wrapper) => wrapper.appointment);
}

/**
 * Represents a unique district (court) for selection in a dropdown.
 */
interface DistrictOption {
  courtId: string;
  courtName: string;
  state?: string;
}

/**
 * Represents a division within a district for selection in a dropdown.
 */
interface DivisionOption {
  courtDivisionCode: string;
  courtDivisionName: string;
}

/**
 * Builds combined "District (Division)" ComboBox options from a flat courts list.
 *
 * For each district, prepends an "All [CourtName]" option (value: `${courtId}|ALL`)
 * followed by individual divisions (value: `${courtId}|${courtDivisionCode}`).
 * Options are sorted by state then court name; divisions within a court are sorted
 * alphabetically by division name.
 *
 * @param courts - Flat array of court division details
 * @returns Ordered ComboOption-shaped array for use in a combined district/division combobox
 */
export function getDistrictDivisionComboOptions(
  courts: CourtDivisionDetails[],
): { value: string; label: string; selectedLabel?: string }[] {
  const districtMap = groupDivisionsByDistrict(courts);
  const uniqueDistricts = sortByCourtLocation(
    Array.from(districtMap.values()).map((divisions) => divisions[0]),
  );

  const options: { value: string; label: string; selectedLabel?: string }[] = [];

  for (const district of uniqueDistricts) {
    const divisions = districtMap
      .get(district.courtId)!
      .sort((a, b) => a.courtDivisionName.localeCompare(b.courtDivisionName));

    options.push({
      value: `${district.courtId}|ALL`,
      label: `${district.courtName} (All)`,
      selectedLabel: `${district.courtName} (All)`,
    });

    for (const div of divisions) {
      options.push({
        value: `${district.courtId}|${div.courtDivisionCode}`,
        label: `${district.courtName} (${div.courtDivisionName})`,
        selectedLabel: `${div.courtDivisionName}`,
      });
    }
  }

  return options;
}

/**
 * Extracts unique districts from a flat array of CourtDivisionDetails.
 * Deduplicates by courtId and sorts by state name then court name.
 *
 * @param courts - Flat array of court division details (one entry per division)
 * @returns Array of unique districts sorted by state and court name
 *
 * @example
 * const courts = [
 *   { courtId: '097', courtName: 'District of Alaska', state: 'AK', ... },
 *   { courtId: '097', courtName: 'District of Alaska', state: 'AK', ... }, // duplicate
 *   { courtId: '081', courtName: 'Northern District of California', state: 'CA', ... }
 * ];
 * getUniqueDistricts(courts);
 * // Returns: [
 * //   { courtId: '097', courtName: 'District of Alaska', state: 'AK' },
 * //   { courtId: '081', courtName: 'Northern District of California', state: 'CA' }
 * // ]
 */
export function getUniqueDistricts(courts: CourtDivisionDetails[]): DistrictOption[] {
  // Deduplicate by courtId using a Map
  const districtMap = new Map<string, DistrictOption>();

  for (const court of courts) {
    if (!districtMap.has(court.courtId)) {
      districtMap.set(court.courtId, {
        courtId: court.courtId,
        courtName: court.courtName,
        state: court.state,
      });
    }
  }

  // Convert to array and sort by state then court name
  const districts = Array.from(districtMap.values());

  return districts.sort(compareByStateAndCourt);
}

/**
 * Gets all divisions for a specific district (court).
 * Returns divisions sorted alphabetically by division name.
 *
 * @param courts - Flat array of court division details
 * @param courtId - The court ID to filter by
 * @returns Array of divisions for the specified court, sorted alphabetically
 *
 * @example
 * getDivisionsForDistrict(courts, '097');
 * // Returns: [
 * //   { courtDivisionCode: '710', courtDivisionName: 'Juneau' },
 * //   { courtDivisionCode: '711', courtDivisionName: 'Nome' }
 * // ]
 */
export function getDivisionsForDistrict(
  courts: CourtDivisionDetails[],
  courtId: string,
): DivisionOption[] {
  const divisions = courts
    .filter((court) => court.courtId === courtId)
    .map((court) => ({
      courtDivisionCode: court.courtDivisionCode,
      courtDivisionName: court.courtDivisionName,
    }));

  // Sort alphabetically by division name
  return divisions.sort((a, b) => a.courtDivisionName.localeCompare(b.courtDivisionName));
}

/**
 * Build a human-readable display string for an appointment's divisions.
 *
 * Handles multiple data shapes:
 * - New format: divisionCodes array → looks up names, shows "All" if every division selected
 * - Legacy format with enriched name: courtDivisionName already provided by backend
 * - Legacy format with code only: looks up name from courts data, falls back to raw code
 *
 * @param appointment - Object containing division fields from the appointment
 * @param allCourts - Full courts dataset for name lookups (may be empty if not yet loaded)
 * @returns Display string such as "All", "Springfield, St. Louis", or "Not specified"
 */
export function buildDivisionsDisplay(
  appointment: {
    courtId?: string;
    divisionCode?: string;
    divisionCodes?: string[];
    courtDivisionName?: string;
  },
  allCourts: CourtDivisionDetails[],
): string {
  if (appointment.divisionCodes && appointment.divisionCodes.length > 0) {
    if (appointment.courtId && allCourts.length > 0) {
      const divisions = getDivisionsForDistrict(allCourts, appointment.courtId);
      const allDivisionCodes = divisions.map((d) => d.courtDivisionCode);

      const hasAllDivisions =
        appointment.divisionCodes.length === allDivisionCodes.length &&
        appointment.divisionCodes.every((code) => allDivisionCodes.includes(code));

      if (hasAllDivisions) return 'All';

      return appointment.divisionCodes
        .map((code) => {
          const division = divisions.find((d) => d.courtDivisionCode === code);
          return division?.courtDivisionName || code;
        })
        .sort()
        .join(', ');
    }
    return appointment.divisionCodes.join(', ');
  }

  if (appointment.courtDivisionName) {
    return appointment.courtDivisionName;
  }

  if (appointment.divisionCode && appointment.courtId && allCourts.length > 0) {
    const divisions = getDivisionsForDistrict(allCourts, appointment.courtId);
    const division = divisions.find((d) => d.courtDivisionCode === appointment.divisionCode);
    return division?.courtDivisionName || appointment.divisionCode;
  }

  if (appointment.divisionCode) {
    return appointment.divisionCode;
  }

  return 'Not specified';
}
