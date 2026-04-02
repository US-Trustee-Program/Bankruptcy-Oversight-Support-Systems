/**
 * ATS-specific type definitions for trustee migration
 */

import { AppointmentType, AppointmentStatus } from '@common/cams/trustees';
import { TrusteeAppointmentInput } from '@common/cams/trustee-appointments';

/**
 * Raw trustee record from ATS TRUSTEES table
 */
export interface AtsTrusteeRecord {
  ID: number; // Maps from ID column in TRUSTEES table
  LAST_NAME?: string;
  FIRST_NAME?: string;
  MIDDLE?: string;
  COMPANY?: string;
  // Public address fields
  STREET?: string;
  STREET1?: string;
  CITY?: string;
  STATE?: string;
  ZIP?: string;
  ZIP_PLUS?: string;
  // Internal address fields (A2 = Address 2)
  STREET_A2?: string;
  STREET1_A2?: string;
  CITY_A2?: string;
  STATE_A2?: string;
  ZIP_A2?: string;
  ZIP_PLUS_A2?: string;
  // Contact fields
  TELEPHONE?: string;
  EMAIL_ADDRESS?: string;
}

/**
 * Raw appointment record from ATS CHAPTER_DETAILS table
 */
export interface AtsAppointmentRecord {
  TRU_ID: number;
  DISTRICT: string;
  DIVISION?: string;
  STATE?: string;
  CHAPTER: string;
  DATE_APPOINTED?: Date;
  STATUS?: string;
  EFFECTIVE_DATE?: Date;
}

/**
 * Mapping result for TOD STATUS to appointment type and status
 */
export interface StatusMapping {
  appointmentType: AppointmentType;
  status: AppointmentStatus;
}

/**
 * Mapping result for chapter parsing
 */
export interface ChapterMapping {
  chapter: string;
  appointmentType?: 'case-by-case';
}

/**
 * Result of processing trustee appointments through cleansing pipeline
 */
export interface TrusteeAppointmentsResult {
  /** Successfully cleansed appointments (CLEAN + AUTO_RECOVERABLE) */
  cleanAppointments: TrusteeAppointmentInput[];

  /** Failed appointments (PROBLEMATIC + UNCLEANSABLE) with error details */
  failedAppointments: FailedAppointment[];

  /** Statistics */
  stats: {
    total: number; // Total raw appointments from ATS
    clean: number; // CLEAN classifications
    autoRecoverable: number; // AUTO_RECOVERABLE classifications
    problematic: number; // PROBLEMATIC classifications
    uncleansable: number; // UNCLEANSABLE classifications
    skipped: number; // SKIP classifications (from overrides)
  };
}

/**
 * Failed appointment with error details for DLQ
 */
export interface FailedAppointment {
  /** Original ATS appointment record */
  atsAppointment: AtsAppointmentRecord;

  /** Cleansing classification (PROBLEMATIC or UNCLEANSABLE) */
  classification: 'PROBLEMATIC' | 'UNCLEANSABLE';

  /** Human-readable error notes from cleansing pipeline */
  notes: string[];

  /** Cleansing map type that was attempted */
  mapType: string;

  /** Timestamp of when this was processed */
  timestamp: string;
}
