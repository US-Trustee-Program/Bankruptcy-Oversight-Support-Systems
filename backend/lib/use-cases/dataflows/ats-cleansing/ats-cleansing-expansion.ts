import { AtsAppointmentRecord } from '../../../adapters/types/ats.types';
import { CleansingWorkRecord, CleansingClassification } from './ats-cleansing-types';
import { STATE_TO_SINGLE_COURT_ID, STATE_DISTRICT_TO_COURT_ID } from './ats-cleansing-maps';
import { normalizeForComparison, splitMultiValue } from './ats-cleansing-utils';

/**
 * Stage 2: Expansion
 * Split multi-value fields, detect regional patterns, handle parallel arrays
 */
export function expand(
  workRecord: CleansingWorkRecord,
  _original: AtsAppointmentRecord,
): CleansingWorkRecord {
  if (workRecord.records.length !== 1) {
    return workRecord;
  }

  const record = workRecord.records[0];
  const notes = [...workRecord.notes];

  const districts = splitMultiValue(record.DISTRICT);
  const states = splitMultiValue(record.STATE);

  // No multi-values - return as-is
  if (districts.length <= 1 && states.length <= 1) {
    return workRecord;
  }

  // Multi-district AND multi-state
  if (districts.length > 1 && states.length > 1) {
    // Check regional patterns first
    const regional = detectRegionalPattern(districts, states);
    if (regional) {
      const [courtIds, note] = regional;
      notes.push(note);
      // Create one record per court ID with empty district/state (already mapped)
      const expanded = courtIds.map((_) => ({
        ...record,
        DISTRICT: '',
        STATE: '',
      }));
      return {
        ...workRecord,
        records: expanded,
        classification: CleansingClassification.CLEAN, // Regional patterns are clean/straightforward
        courtIds,
        mapType: `1:${courtIds.length}`,
        notes,
        expanded: true,
      };
    }

    // Check parallel arrays
    const parallel = checkParallelArrays(districts, states);
    if (parallel) {
      const expanded = parallel.map(([d, s]) => ({
        ...record,
        DISTRICT: d,
        STATE: s,
      }));
      notes.push(`Parallel arrays: ${parallel.length} pairs`);
      return {
        ...workRecord,
        records: expanded,
        classification: CleansingClassification.CLEAN, // Parallel arrays are straightforward
        courtIds: [], // Will be mapped in stage 3
        mapType: '',
        notes,
        expanded: true,
      };
    }

    // Ambiguous
    notes.push(`Ambiguous: ${districts.length} districts × ${states.length} states`);
    return {
      ...workRecord,
      records: [record],
      classification: CleansingClassification.PROBLEMATIC,
      courtIds: [],
      mapType: '',
      notes,
    };
  }

  // Multi-district only
  if (districts.length > 1) {
    const expanded = districts.map((d) => ({
      ...record,
      DISTRICT: d,
    }));
    notes.push(`Expanded: ${districts.length} districts`);
    return {
      ...workRecord,
      records: expanded,
      classification: CleansingClassification.AUTO_RECOVERABLE,
      courtIds: [],
      mapType: '',
      notes,
      expanded: true,
    };
  }

  // Multi-state only
  if (states.length > 1) {
    // Check if all single-district
    const allSingleDistrict = states.every(
      (s) => STATE_TO_SINGLE_COURT_ID[normalizeForComparison(s)],
    );

    if (allSingleDistrict) {
      const expanded = states.map((s) => ({
        ...record,
        DISTRICT: '',
        STATE: s,
      }));
      notes.push(`Expanded: ${states.length} single-district states`);
      return {
        ...workRecord,
        records: expanded,
        classification: CleansingClassification.AUTO_RECOVERABLE,
        courtIds: [],
        mapType: '',
        notes,
        expanded: true,
      };
    }

    // Hybrid: 1 district + multi states
    if (record.DISTRICT && record.DISTRICT !== 'NULL') {
      const hybridResult = expandHybrid(record.DISTRICT, states);
      if (hybridResult) {
        const [pairs, failedStates] = hybridResult;
        const expanded = pairs.map(([d, s]) => ({
          ...record,
          DISTRICT: d || record.DISTRICT,
          STATE: s,
        }));

        // Determine classification:
        // - If states failed: PROBLEMATIC (partial failure)
        // - If all states are multi-district: PROBLEMATIC (ambiguous - can't assume district applies to all)
        // - If mix of single/multi-district: CLEAN (not ambiguous - district applies to multi, single don't care)
        let classification: CleansingClassification;

        if (failedStates.length > 0) {
          classification = CleansingClassification.PROBLEMATIC;
          // Build warning messages
          const warnings = failedStates.map(
            (s) =>
              `WARNING: ${record.DISTRICT.trim().toUpperCase()} District does not exist for ${s.trim().toUpperCase()}`,
          );
          notes.push(...warnings);
          notes.push(`Expanded: 1 district(s) x ${states.length} state(s)`);
        } else {
          // Check if all states that mapped are multi-district (ambiguous)
          const allMultiDistrict = pairs
            .filter(([_, s]) => s) // Only check states with values
            .every(([_, s]) => !STATE_TO_SINGLE_COURT_ID[normalizeForComparison(s)]);

          if (allMultiDistrict && pairs.length > 1) {
            // All multi-district states - ambiguous whether district applies to all
            classification = CleansingClassification.PROBLEMATIC;
          } else {
            // Mix of single/multi-district - not ambiguous
            classification = CleansingClassification.CLEAN;
          }
          notes.push(`Expanded: 1 district(s) x ${states.length} state(s)`);
        }

        return {
          ...workRecord,
          records: expanded,
          classification,
          courtIds: [],
          mapType: '',
          notes,
          expanded: true,
        };
      }
    }
  }

  // Couldn't expand safely
  return workRecord;
}

/**
 * Detect regional responsibility patterns
 * Returns [courtIds, note] or null
 */
function detectRegionalPattern(districts: string[], states: string[]): [string[], string] | null {
  const districtSet = new Set(districts.map((d) => normalizeForComparison(d)));
  const stateSet = new Set(states.map((s) => normalizeForComparison(s)));

  // Chicago/Milwaukee metro
  if (
    districtSet.has('EASTERN') &&
    districtSet.has('WESTERN') &&
    districtSet.has('NORTHERN') &&
    stateSet.has('WISCONSIN') &&
    stateSet.has('ILLINOIS')
  ) {
    return [
      ['0757', '0758', '0752'],
      'Chicago/Milwaukee metro: Eastern WI, Western WI, Northern IL',
    ];
  }

  // Louisiana/Mississippi region
  if (
    stateSet.has('LOUISIANA') &&
    stateSet.has('MISSISSIPPI') &&
    districtSet.has('EASTERN') &&
    districtSet.has('MIDDLE') &&
    districtSet.has('WESTERN') &&
    districtSet.has('NORTHERN') &&
    districtSet.has('SOUTHERN')
  ) {
    return [
      ['053L', '053N', '0536', '0537', '0538'],
      'Louisiana/Mississippi region: All 5 districts across both states',
    ];
  }

  // Upper Midwest region
  if (
    districtSet.has('NORTHERN') &&
    districtSet.has('SOUTHERN') &&
    stateSet.has('IOWA') &&
    stateSet.has('NORTH DAKOTA') &&
    stateSet.has('SOUTH DAKOTA') &&
    stateSet.has('MINNESOTA')
  ) {
    return [['0862', '0863', '0868', '0869', '0864'], 'Upper Midwest region: IA/ND/SD/MN'];
  }

  // Iowa/South Dakota
  if (
    districtSet.has('NORTHERN') &&
    districtSet.has('SOUTHERN') &&
    stateSet.has('IOWA') &&
    stateSet.has('SOUTH DAKOTA') &&
    states.length === 2
  ) {
    return [['0862', '0863', '0869'], 'Iowa/SD region'];
  }

  // Northern CA/Nevada
  if (
    (districtSet.has('NORTHERN') || districtSet.has('EASTERN')) &&
    stateSet.has('CALIFORNIA') &&
    stateSet.has('NEVADA')
  ) {
    return [['0971', '0972', '0978'], 'Northern CA/NV region'];
  }

  // New York State/Vermont (all 4 NY districts + VT) - check this BEFORE Upstate NY/VT
  if (
    districtSet.has('EASTERN') &&
    districtSet.has('NORTHERN') &&
    districtSet.has('SOUTHERN') &&
    districtSet.has('WESTERN') &&
    stateSet.has('NEW YORK') &&
    stateSet.has('VERMONT')
  ) {
    return [['0207', '0206', '0208', '0209', '0210'], 'NY State/VT region: All NY + VT'];
  }

  // Upstate NY/Vermont (only Northern + Western)
  if (
    districtSet.has('NORTHERN') &&
    districtSet.has('WESTERN') &&
    stateSet.has('NEW YORK') &&
    stateSet.has('VERMONT') &&
    states.length === 2
  ) {
    return [['0206', '0209', '0210'], 'Upstate NY/VT region'];
  }

  // Pacific Northwest
  if (
    districtSet.has('EASTERN') &&
    districtSet.has('WESTERN') &&
    stateSet.has('WASHINGTON') &&
    stateSet.has('OREGON')
  ) {
    return [['0980', '0981', '0979'], 'Pacific NW region'];
  }

  return null;
}

/**
 * Check if districts/states form parallel arrays
 * Returns list of (district, state) pairs or null
 */
function checkParallelArrays(
  districts: string[],
  states: string[],
): Array<[string, string]> | null {
  if (districts.length !== states.length) {
    return null;
  }

  const pairs: Array<[string, string]> = [];

  for (let i = 0; i < districts.length; i++) {
    const distNorm = normalizeForComparison(districts[i]);
    const stateNorm = normalizeForComparison(states[i]);

    // Reject if state is single-district
    if (STATE_TO_SINGLE_COURT_ID[stateNorm]) {
      return null;
    }

    // Check if this district exists for this state
    const stateMap = STATE_DISTRICT_TO_COURT_ID[stateNorm];
    if (!stateMap || !stateMap[distNorm]) {
      return null;
    }

    pairs.push([districts[i], states[i]]);
  }

  return pairs.length > 0 ? pairs : null;
}

/**
 * Expand hybrid case: 1 district + multiple states (some single-district)
 * Returns [pairs, failedStates] or null
 */
function expandHybrid(
  district: string,
  states: string[],
): [Array<[string, string]>, string[]] | null {
  const distNorm = normalizeForComparison(district);
  const pairs: Array<[string, string]> = [];
  const failedStates: string[] = [];

  for (const state of states) {
    const stateNorm = normalizeForComparison(state);

    if (STATE_TO_SINGLE_COURT_ID[stateNorm]) {
      // Single-district state - district doesn't matter
      pairs.push(['', state]);
    } else {
      // Multi-district state - check if district is valid
      const stateMap = STATE_DISTRICT_TO_COURT_ID[stateNorm];
      if (stateMap && stateMap[distNorm]) {
        pairs.push([district, state]);
      } else {
        failedStates.push(state);
      }
    }
  }

  return pairs.length > 0 ? [pairs, failedStates] : null;
}
