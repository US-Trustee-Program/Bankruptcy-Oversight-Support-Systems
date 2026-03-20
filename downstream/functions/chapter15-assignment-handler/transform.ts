/**
 * Transforms CAMS CaseAssignmentEvent to ACMS CMMAP staging table format
 */

export interface CaseAssignmentEvent {
  caseId: string; // CAMS case ID (e.g., "081-24-12345")
  userId: string; // CAMS user ID
  name: string; // Attorney name
  role: string; // "TrialAttorney"
  assignedOn: string; // ISO timestamp
  unassignedOn?: string; // ISO timestamp (if unassigned)
}

export interface CmmapStagingRow {
  DELETE_CODE: string;
  CASE_DIV: number;
  CASE_YEAR: number;
  CASE_NUMBER: number;
  RECORD_SEQ_NBR: number;
  PROF_CODE: number; // PLACEHOLDER - mapping TBD
  GROUP_DESIGNATOR: string; // PLACEHOLDER - mapping TBD
  APPT_TYPE: string;
  APPT_DATE: number | null; // YYYYMMDD numeric format
  APPT_DATE_DT: Date | null;
  APPT_DISP: string | null;
  DISP_DATE: number | null;
  DISP_DATE_DT: Date | null;
  COMMENTS: string | null;
  APPTEE_ACTIVE: string;
  ALPHA_SEARCH: string | null; // Attorney last name
  USER_ID: string | null;
  HEARING_SEQUENCE: number | null;
  REGION_CODE: string | null;
  RGN_CREATE_DATE: number | null;
  RGN_UPDATE_DATE: number | null;
  RGN_CREATE_DATE_DT: Date | null;
  RGN_UPDATE_DATE_DT: Date | null;
  CDB_CREATE_DATE: number | null;
  CDB_UPDATE_DATE: number | null;
  CDB_CREATE_DATE_DT: Date | null;
  CDB_UPDATE_DATE_DT: Date | null;
  UPDATE_DATE: Date;
  SOURCE: string;
  CAMS_CASE_ID: string;
  CAMS_USER_ID: string;
  CAMS_USER_NAME: string;
  LAST_UPDATED: Date;
}

/**
 * Parse CAMS case ID (e.g., "081-24-12345") into components
 */
export function parseCaseId(caseId: string): { div: number; year: number; number: number } {
  const match = caseId.match(/^(\d{3})-(\d{2})-(\d{5})$/);
  if (!match) {
    throw new Error(`Invalid CAMS case ID format: ${caseId}`);
  }

  return {
    div: parseInt(match[1], 10),
    year: parseInt(match[2], 10),
    number: parseInt(match[3], 10),
  };
}

/**
 * Convert ISO date string to ACMS positional integer date format
 * ACMS stores dates as integers using pattern: YYYY * 10000 + MM * 100 + DD
 * Example: 2024-11-15 → 20241115 (not epoch milliseconds)
 * Pattern from backend/lib/adapters/gateways/acms/acms.gateway.ts
 * Handles date-only (YYYY-MM-DD) or full ISO timestamp strings
 */
export function toAcmsDateNumeric(isoDateString: string): number {
  // Extract date portion (YYYY-MM-DD) from full ISO timestamp if needed
  const datePortion = isoDateString.split('T')[0];
  // Remove hyphens and parse to integer: '2024-11-15' → '20241115' → 20241115
  return parseInt(datePortion.replace(/-/g, ''), 10);
}

/**
 * Extract last name from full name for ALPHA_SEARCH field
 * Simple implementation: last word in name
 */
export function extractLastName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  return parts[parts.length - 1].toUpperCase();
}

/**
 * PLACEHOLDER: Generate professional code
 * TODO: Implement actual mapping strategy
 * Options:
 * - Option A: "ZZ-{incrementing_int}" pattern, return numeric part
 * - Option B: "{GROUP_DESIGNATOR}-{decrementing_int}" pattern, return numeric part
 */
export function generateProfessionalCode(userId: string): { code: number; group: string } {
  // PLACEHOLDER IMPLEMENTATION
  // For now, use a hash of userId to generate a stable numeric code
  const hash = userId.split('').reduce((acc, char) => {
    return (acc << 5) - acc + char.charCodeAt(0);
  }, 0);

  const code = Math.abs(hash) % 100000; // 5-digit code
  const group = 'ZZ'; // Placeholder group designator

  return { code, group };
}

/**
 * Transform CAMS CaseAssignmentEvent to ACMS CMMAP staging row
 */
export function transformToStagingRow(event: CaseAssignmentEvent): CmmapStagingRow {
  const { div, year, number } = parseCaseId(event.caseId);
  const { code, group } = generateProfessionalCode(event.userId);
  const now = new Date();

  const isUnassigned = !!event.unassignedOn;
  const apptDate = toAcmsDateNumeric(event.assignedOn);
  const dispDate = isUnassigned ? toAcmsDateNumeric(event.unassignedOn!) : null;

  return {
    DELETE_CODE: ' ', // Active record
    CASE_DIV: div,
    CASE_YEAR: year,
    CASE_NUMBER: number,
    RECORD_SEQ_NBR: 1, // Chapter 15 has only one attorney (S1)
    PROF_CODE: code,
    GROUP_DESIGNATOR: group,
    APPT_TYPE: 'S1', // Staff type 1 (primary attorney)
    APPT_DATE: apptDate,
    APPT_DATE_DT: new Date(event.assignedOn),
    APPT_DISP: isUnassigned ? 'TR' : null, // 'TR' = Terminated/Removed (placeholder)
    DISP_DATE: dispDate,
    DISP_DATE_DT: isUnassigned ? new Date(event.unassignedOn!) : null,
    COMMENTS: null,
    APPTEE_ACTIVE: isUnassigned ? 'N' : 'Y',
    ALPHA_SEARCH: extractLastName(event.name),
    USER_ID: 'CAMS', // System user
    HEARING_SEQUENCE: null,
    REGION_CODE: null,
    RGN_CREATE_DATE: null,
    RGN_UPDATE_DATE: null,
    RGN_CREATE_DATE_DT: null,
    RGN_UPDATE_DATE_DT: null,
    CDB_CREATE_DATE: toAcmsDateNumeric(now.toISOString()),
    CDB_UPDATE_DATE: toAcmsDateNumeric(now.toISOString()),
    CDB_CREATE_DATE_DT: now,
    CDB_UPDATE_DATE_DT: now,
    UPDATE_DATE: now,
    SOURCE: 'CAMS',
    CAMS_CASE_ID: event.caseId,
    CAMS_USER_ID: event.userId,
    CAMS_USER_NAME: event.name,
    LAST_UPDATED: now,
  };
}
