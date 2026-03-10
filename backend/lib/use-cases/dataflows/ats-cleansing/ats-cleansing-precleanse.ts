import { AtsAppointmentRecord } from '../../../adapters/types/ats.types';
import { CleansingWorkRecord } from './ats-cleansing-types';
import {
  STATE_NAME_NORMALIZATION,
  DISTRICT_NAME_CORRECTIONS,
  CITY_TO_STATE,
  CITY_IN_DISTRICT_TO_MAPPING,
} from './ats-cleansing-maps';
import { normalizeForComparison, copyAppointmentRecord } from './ats-cleansing-utils';

/**
 * Stage 1: Pre-cleanse
 * Fix data quality issues: typos, column reversals, delimiter artifacts
 */
export function precleanse(
  workRecord: CleansingWorkRecord,
  _original: AtsAppointmentRecord,
): CleansingWorkRecord {
  const notes = [...workRecord.notes];
  const cleaned = copyAppointmentRecord(workRecord.records[0]);

  // Apply typo corrections to district
  let [district, note] = fixTypos(cleaned.DISTRICT, DISTRICT_NAME_CORRECTIONS);
  if (note) {
    notes.push(note);
    cleaned.DISTRICT = district;
  }

  // Apply typo corrections to state
  [cleaned.STATE, note] = fixTypos(cleaned.STATE, STATE_NAME_NORMALIZATION);
  if (note) {
    notes.push(note);
  }

  // Remove delimiter artifacts
  [district, note] = removeDelimiterArtifacts(cleaned.DISTRICT);
  if (note) {
    notes.push(note);
    cleaned.DISTRICT = district;
  }

  // Expand abbreviations
  [district, note] = expandAbbreviations(cleaned.DISTRICT);
  if (note) {
    notes.push(note);
    cleaned.DISTRICT = district;
  }

  // Fix adjacent direction words
  [district, note] = fixAdjacentDirectionWords(cleaned.DISTRICT);
  if (note) {
    notes.push(note);
    cleaned.DISTRICT = district;
  }

  // Column reversal detection
  const districtUpper = normalizeForComparison(cleaned.DISTRICT);
  const stateUpper = normalizeForComparison(cleaned.STATE);

  if (
    districtUpper.includes('DISTRICT OF COLUMBIA') &&
    (stateUpper.includes('DC') || stateUpper.includes('VIRGINIA'))
  ) {
    // Extract actual district from the district field
    const parts = cleaned.DISTRICT.split(',').map((p) => p.trim());
    for (const part of parts) {
      const partClean = part.trim().toUpperCase();
      if (['EASTERN', 'WESTERN', 'NORTHERN', 'SOUTHERN', 'MIDDLE', 'CENTRAL'].includes(partClean)) {
        notes.push(`Column reversal: extracted "${part}" from district, corrected state to VA+DC`);
        cleaned.DISTRICT = part;
        cleaned.STATE = 'Virginia, District of Columbia';
        break;
      }
    }
  }

  // City-to-geography mapping
  // Check city in DISTRICT column first
  const districtUpper2 = normalizeForComparison(cleaned.DISTRICT);
  if (CITY_IN_DISTRICT_TO_MAPPING[districtUpper2]) {
    const [newDistrict, newState, _courtId] = CITY_IN_DISTRICT_TO_MAPPING[districtUpper2];
    const stateUpper2 = normalizeForComparison(cleaned.STATE);
    if (stateUpper2 === normalizeForComparison(newState)) {
      notes.push(`City-to-geography: ${cleaned.DISTRICT}→${newDistrict} District`);
      cleaned.DISTRICT = newDistrict;
      cleaned.STATE = newState;
    }
  }

  // Check city in STATE column
  const stateUpper3 = normalizeForComparison(cleaned.STATE);
  if (CITY_TO_STATE[stateUpper3]) {
    notes.push(`City-to-state: ${cleaned.STATE}→${CITY_TO_STATE[stateUpper3]}`);
    cleaned.STATE = CITY_TO_STATE[stateUpper3];
  }

  // One-off corrections
  if (
    normalizeForComparison(cleaned.DISTRICT) === 'WESTERN' &&
    normalizeForComparison(cleaned.STATE) === 'OHIO'
  ) {
    notes.push('One-off: Western OH→Southern OH');
    cleaned.DISTRICT = 'Southern';
  }

  if (
    normalizeForComparison(cleaned.DISTRICT) === 'SOUTHERN/CENTRAL' &&
    normalizeForComparison(cleaned.STATE) === 'INDIANA'
  ) {
    notes.push('One-off: Southern/Central IN→Southern IN');
    cleaned.DISTRICT = 'Southern';
  }

  return {
    ...workRecord,
    records: [cleaned],
    notes,
  };
}

/**
 * Fix typos using a correction map
 */
function fixTypos(
  value: string | undefined,
  corrections: Record<string, string>,
): [string, string | null] {
  if (!value || value === 'NULL') {
    return [value || '', null];
  }

  const valueUpper = value.trim().toUpperCase();
  if (corrections[valueUpper]) {
    return [corrections[valueUpper], `Typo: ${value}→${corrections[valueUpper]}`];
  }
  return [value, null];
}

/**
 * Remove delimiter artifacts (trailing slashes)
 */
function removeDelimiterArtifacts(value: string | undefined): [string, string | null] {
  if (!value || value === 'NULL') {
    return [value || '', null];
  }

  const cleaned = value.trim().replace(/^\/+|\/+$/g, '');
  if (cleaned !== value.trim()) {
    return [cleaned, `Removed delimiter artifacts: ${value}→${cleaned}`];
  }
  return [value, null];
}

/**
 * Expand abbreviations
 */
function expandAbbreviations(value: string | undefined): [string, string | null] {
  if (!value || value === 'NULL') {
    return [value || '', null];
  }

  const expansions: Record<string, string> = {
    'ND/SD': 'Northern/Southern',
  };

  const valueUpper = value.trim().toUpperCase();
  for (const [abbrev, expansion] of Object.entries(expansions)) {
    if (valueUpper === abbrev.toUpperCase()) {
      return [expansion, `Expanded: ${value}→${expansion}`];
    }
  }

  return [value, null];
}

/**
 * Fix adjacent direction words (add comma separator)
 */
function fixAdjacentDirectionWords(value: string | undefined): [string, string | null] {
  if (!value || value === 'NULL') {
    return [value || '', null];
  }

  const directions = ['Eastern', 'Western', 'Northern', 'Southern', 'Middle', 'Central'];
  const pattern = new RegExp(`\\b(${directions.join('|')})\\s+(${directions.join('|')})\\b`, 'gi');

  const fixed = value.replace(pattern, '$1, $2');
  if (fixed !== value) {
    return [fixed, `Fixed adjacent words: ${value}→${fixed}`];
  }
  return [value, null];
}
