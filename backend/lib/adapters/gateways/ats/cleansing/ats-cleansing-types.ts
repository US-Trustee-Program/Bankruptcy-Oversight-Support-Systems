import { TrusteeAppointmentInput } from '@common/cams/trustee-appointments';
import { AtsAppointmentRecord } from '../../../../adapters/types/ats.types';

/**
 * Classification of appointment after cleansing pipeline
 */
export enum CleansingClassification {
  /** Successfully cleansed and mapped - ready for migration */
  CLEAN = 'CLEAN',

  /** Successfully cleansed with inference (NULL district + single-state, etc.) */
  AUTO_RECOVERABLE = 'AUTO_RECOVERABLE',

  /** Failed validation - ambiguous data (multi-district × multi-state, etc.) */
  PROBLEMATIC = 'PROBLEMATIC',

  /** Failed validation - missing required data (NULL status, NULL geography) */
  UNCLEANSABLE = 'UNCLEANSABLE',

  /** Skipped per override directive */
  SKIP = 'SKIP',
}

/**
 * Result of running an appointment through the cleansing pipeline
 */
export interface CleansingResult {
  /** Final classification after all pipeline stages */
  classification: CleansingClassification;

  /** Successfully mapped appointment (only present for CLEAN/AUTO_RECOVERABLE) */
  appointment?: TrusteeAppointmentInput;

  /** Mapped court IDs (may be multiple for 1:N expansions) */
  courtIds: string[];

  /** Map type descriptor (e.g., "1:1", "1:3", "UNMAPPED", "OVERRIDE:1:1") */
  mapType: string;

  /** Pipeline processing notes (typo fixes, expansions, warnings, errors) */
  notes: string[];

  /** True if SKIP classification due to override */
  skip: boolean;
}

/**
 * Internal working record during pipeline processing
 */
export interface CleansingWorkRecord {
  /** Current record(s) being processed (may expand from 1 to N) */
  records: AtsAppointmentRecord[];

  /** Current classification (updated by each stage) */
  classification: CleansingClassification;

  /** Mapped court IDs (populated by mapping stage) */
  courtIds: string[];

  /** Map type descriptor */
  mapType: string;

  /** Accumulated processing notes */
  notes: string[];

  /** Skip flag from override stage */
  skip: boolean;

  /** Flag indicating expansion occurred (for classification logic) */
  expanded: boolean;
}

/**
 * Trustee appointment override directive
 */
export interface TrusteeOverride {
  trusteeId: string; // ATS TRU_ID
  status: string; // Original STATUS
  district: string; // Original DISTRICT
  state: string; // Original SERVING_STATE
  chapter: string; // Original CHAPTER
  action: 'SKIP' | 'MAP'; // Directive
  overrideStatus?: string;
  overrideDistrict?: string;
  overrideState?: string;
  overrideChapter?: string;
  overrideCourtId?: string;
  notes?: string;
}

// Note: FailedAppointment interface removed - gateway now handles failures internally
// Failed appointments are logged but not returned to callers
