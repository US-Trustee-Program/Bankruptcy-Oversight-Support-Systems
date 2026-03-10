import { AtsAppointmentRecord } from '../../../../adapters/types/ats.types';
import { CleansingWorkRecord } from './ats-cleansing-types';
import { STATE_TO_SINGLE_COURT_ID, STATE_DISTRICT_TO_COURT_ID } from './ats-cleansing-maps';
import { normalizeForComparison } from './ats-cleansing-utils';

/**
 * Stage 3: Mapping
 * Map district+state to court IDs
 */
export function mapToCourtId(workRecord: CleansingWorkRecord): CleansingWorkRecord {
  // If court IDs already set (from regional pattern), return as-is
  if (workRecord.courtIds && workRecord.courtIds.length > 0) {
    return workRecord;
  }

  const allCourtIds: string[] = [];
  const allNotes = [...workRecord.notes];
  const errors: string[] = [];

  for (const record of workRecord.records) {
    const [courtIds, _singleMapType, notes] = mapSingleRecord(record);

    // Add unique court IDs only
    for (const courtId of courtIds) {
      if (!allCourtIds.includes(courtId)) {
        allCourtIds.push(courtId);
      }
    }

    // Collect error notes
    if (courtIds.length === 0 && notes.length > 0) {
      errors.push(...notes);
    }
  }

  // Map type is based on number of court IDs, not number of records
  const mapType = allCourtIds.length > 0 ? `1:${allCourtIds.length}` : 'UNMAPPED';

  // Add error notes if any
  if (errors.length > 0) {
    allNotes.push(...errors);
  }

  return {
    ...workRecord,
    courtIds: allCourtIds,
    mapType,
    notes: allNotes,
  };
}

/**
 * Map a single record to court ID(s)
 * Returns [courtIds, mapType, notes]
 */
function mapSingleRecord(record: AtsAppointmentRecord): [string[], string, string[]] {
  const notes: string[] = [];
  const districtNorm = normalizeForComparison(record.DISTRICT);
  const stateNorm = normalizeForComparison(record.STATE);

  // NULL district and state
  if (!districtNorm && !stateNorm) {
    return [[], 'UNMAPPED', ['Both district and state are NULL']];
  }

  // Single-district state
  if (STATE_TO_SINGLE_COURT_ID[stateNorm]) {
    return [[STATE_TO_SINGLE_COURT_ID[stateNorm]], '1:1', notes];
  }

  // Multi-district state requires district
  if (!districtNorm) {
    return [[], 'UNMAPPED', ['Multi-district state requires district specification']];
  }

  // Look up district + state
  if (STATE_DISTRICT_TO_COURT_ID[stateNorm]) {
    const courtId = STATE_DISTRICT_TO_COURT_ID[stateNorm][districtNorm];
    if (courtId) {
      return [[courtId], '1:1', notes];
    } else {
      return [
        [],
        'UNMAPPED',
        [`Invalid combination: ${districtNorm} District does not exist for ${stateNorm}`],
      ];
    }
  }

  return [[], 'UNMAPPED', [`Unknown state: ${stateNorm}`]];
}
