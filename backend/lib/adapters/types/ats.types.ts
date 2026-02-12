/**
 * ATS-specific type definitions for trustee migration
 */

/**
 * Raw trustee record from ATS TRUSTEES table
 */
export interface AtsTrusteeRecord {
  TRU_ID: number;
  TRU_LAST_NAME?: string;
  TRU_FIRST_NAME?: string;
  TRU_MIDDLE_NAME?: string;
  TRU_COMPANY?: string;
  TRU_ADDRESS1?: string;
  TRU_ADDRESS2?: string;
  TRU_ADDRESS3?: string;
  TRU_CITY?: string;
  TRU_STATE?: string;
  TRU_ZIP?: string;
  TRU_PHONE?: string;
  TRU_EMAIL?: string;
}

/**
 * Raw appointment record from ATS CHAPTER_DETAILS table
 */
export interface AtsAppointmentRecord {
  TRU_ID: number;
  DISTRICT: string;
  DIVISION: string;
  CHAPTER: string;
  DATE_APPOINTED?: Date;
  STATUS: string;
  EFFECTIVE_DATE?: Date;
}

/**
 * Predicate for querying trustees with pagination
 */
export interface AtsTrusteePredicate {
  lastTrusteeId: number | null;
  pageSize: number;
}

/**
 * Result of a paginated trustee query
 */
export interface AtsTrusteePage {
  trustees: AtsTrusteeRecord[];
  hasMore: boolean;
  totalProcessed: number;
}

/**
 * Combined trustee with appointments for processing
 */
export interface AtsTrusteeWithAppointments {
  trustee: AtsTrusteeRecord;
  appointments: AtsAppointmentRecord[];
}

/**
 * Mapping result for TOD STATUS to appointment type and status
 */
export interface StatusMapping {
  appointmentType: 'panel' | 'off-panel' | 'case-by-case' | 'standing';
  status: 'active' | 'inactive' | 'suspended' | 'terminated';
}

/**
 * Mapping result for chapter parsing
 */
export interface ChapterMapping {
  chapter: string;
  appointmentType?: 'case-by-case';
}

/**
 * Migration statistics for tracking progress
 */
export interface MigrationStats {
  trusteesProcessed: number;
  appointmentsProcessed: number;
  errors: number;
  lastTrusteeId: number | null;
  startTime: Date;
  lastUpdateTime: Date;
}
