import { CaseAssignmentDownstreamEvent } from '@common/cams/dataflow-events';
import { CmmapStagingRow } from '../shared/cmmap-staging-row';

export type { CaseAssignmentDownstreamEvent };
export type { CmmapStagingRow };

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

// Convert ISO date string to ACMS positional integer date format (YYYYMMDD)
export function toAcmsDateNumeric(isoDateString: string): number {
  const datePortion = isoDateString.split('T')[0];
  return parseInt(datePortion.replace(/-/g, ''), 10);
}

export function extractLastName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  return parts[parts.length - 1].toUpperCase();
}

// Parse "{GROUP_DESIGNATOR}-{PROF_CODE}" (e.g. "NY-00063") into components
function parseProfessionalId(acmsProfessionalId: string): { group: string; code: number } {
  const dashIndex = acmsProfessionalId.indexOf('-');
  const group = acmsProfessionalId.slice(0, dashIndex);
  const code = parseInt(acmsProfessionalId.slice(dashIndex + 1), 10);
  return { group, code };
}

export function transformToStagingRow(event: CaseAssignmentDownstreamEvent): CmmapStagingRow {
  if (!event.acmsProfessionalId) {
    throw new Error(
      `Cannot transform event: acmsProfessionalId is null for caseId ${event.caseId}`,
    );
  }

  const { div, year, number } = parseCaseId(event.caseId);
  const { group, code } = parseProfessionalId(event.acmsProfessionalId);
  const now = new Date();

  const isUnassigned = !!event.unassignedOn;
  const apptDate = toAcmsDateNumeric(event.assignedOn);
  const dispDate = isUnassigned ? toAcmsDateNumeric(event.unassignedOn!) : null;

  return {
    DELETE_CODE: ' ',
    CASE_DIV: div,
    CASE_YEAR: year,
    CASE_NUMBER: number,
    RECORD_SEQ_NBR: 1,
    PROF_CODE: code,
    GROUP_DESIGNATOR: group,
    APPT_TYPE: 'S1',
    APPT_DATE: apptDate,
    APPT_DATE_DT: new Date(event.assignedOn),
    APPT_DISP: isUnassigned ? 'WD' : 'AP',
    DISP_DATE: dispDate,
    DISP_DATE_DT: isUnassigned ? new Date(event.unassignedOn!) : null,
    COMMENTS: null,
    APPTEE_ACTIVE: isUnassigned ? 'N' : 'Y',
    ALPHA_SEARCH: extractLastName(event.name),
    USER_ID: 'CAMS',
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
