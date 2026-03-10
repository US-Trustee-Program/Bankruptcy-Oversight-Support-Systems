import { AtsAppointmentRecord } from '../../../../adapters/types/ats.types';
import { CleansingWorkRecord, CleansingClassification } from './ats-cleansing-types';
import { STATE_TO_SINGLE_COURT_ID } from './ats-cleansing-maps';
import { normalizeForComparison, splitMultiValue } from './ats-cleansing-utils';

/**
 * Stage 4: Classification
 * Assign final classification based on all previous stages
 */
export function classify(
  workRecord: CleansingWorkRecord,
  original: AtsAppointmentRecord,
): CleansingWorkRecord {
  // Check for NULL status
  if (!original.STATUS || original.STATUS === 'NULL') {
    return {
      ...workRecord,
      classification: CleansingClassification.UNCLEANSABLE,
      notes: [...workRecord.notes, 'NULL status - cannot migrate'],
    };
  }

  // Check for both NULL geography
  const districtNorm = normalizeForComparison(original.DISTRICT);
  const stateNorm = normalizeForComparison(original.STATE);

  if (!districtNorm && !stateNorm) {
    return {
      ...workRecord,
      classification: CleansingClassification.UNCLEANSABLE,
      notes: [...workRecord.notes, 'NULL district and state - no geography'],
    };
  }

  // If mapping failed
  if (workRecord.courtIds.length === 0) {
    return {
      ...workRecord,
      classification: CleansingClassification.PROBLEMATIC,
    };
  }

  // Preserve PROBLEMATIC from expansion
  if (workRecord.classification === CleansingClassification.PROBLEMATIC) {
    return workRecord;
  }

  // Preserve CLEAN from expansion
  if (
    workRecord.classification === CleansingClassification.CLEAN &&
    workRecord.records.length > 1
  ) {
    return workRecord;
  }

  // Expansion occurred - check if multi-district × single-state (should be CLEAN)
  if (workRecord.records.length > 1) {
    const originalDistricts = splitMultiValue(original.DISTRICT);
    const originalStates = splitMultiValue(original.STATE);

    // Multi-district × single-state → CLEAN
    if (originalDistricts.length > 1 && originalStates.length === 1) {
      return {
        ...workRecord,
        classification: CleansingClassification.CLEAN,
      };
    }

    // Other expansions → AUTO_RECOVERABLE
    return {
      ...workRecord,
      classification: CleansingClassification.AUTO_RECOVERABLE,
    };
  }

  // Check for NULL district + single-district state (inference required)
  // NOTE: Use simple normalization to match Python's behavior
  // This means typos in the original state won't be recognized as single-district states
  const origDistrictNorm = normalizeForComparison(original.DISTRICT);

  if (!origDistrictNorm) {
    const origStateSimple = (original.STATE || '').trim().toUpperCase();
    if (
      origStateSimple &&
      origStateSimple !== 'NULL' &&
      STATE_TO_SINGLE_COURT_ID[origStateSimple]
    ) {
      return {
        ...workRecord,
        classification: CleansingClassification.AUTO_RECOVERABLE,
        notes: [...workRecord.notes, 'Inferred district from single-district state'],
      };
    }
  }

  // Default: CLEAN
  return {
    ...workRecord,
    classification: CleansingClassification.CLEAN,
  };
}
