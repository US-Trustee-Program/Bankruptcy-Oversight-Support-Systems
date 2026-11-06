import {
  AcmsCaseAppointmentRawRecord,
  AcmsCaseAppointmentRecord,
  formatCaseId,
  formatAcmsProfessionalId,
} from '../gateways.types';
import { normalizeAcmsCaseChapter } from '../../adapters/gateways/acms/acms.gateway.helper';
import { CaseAppointmentInput } from '@common/cams/trustee-appointments';

export function formatAcmsDate(acmsDate: number): string {
  const s = acmsDate.toString();
  if (s.length !== 8 || acmsDate < 10000000) {
    throw new Error(`Invalid ACMS date format: ${acmsDate}. Expected 8-digit YYYYMMDD.`);
  }
  const year = s.slice(0, 4);
  const month = s.slice(4, 6);
  const day = s.slice(6, 8);
  const formatted = `${year}-${month}-${day}`;

  const date = new Date(formatted);
  if (isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== formatted) {
    throw new Error(`Invalid date: ${formatted} from ACMS date ${acmsDate}`);
  }

  return formatted;
}

export function rawToAppointmentRecord(
  raw: AcmsCaseAppointmentRawRecord,
): AcmsCaseAppointmentRecord {
  return {
    id: raw.id,
    caseId: formatCaseId(raw.CASE_DIV, raw.CASE_YEAR, raw.CASE_NUMBER),
    acmsProfessionalId: formatAcmsProfessionalId(raw.GROUP_DESIGNATOR, raw.PROF_CODE),
    assignDate: raw.APPT_DATE,
    apptDate: raw.APPT_DATE === 0 ? null : raw.APPT_DATE,
    unassignDate: raw.DISP_DATE,
    caseFiledDate: raw.CASE_FILED_DATE,
    chapter: raw.CURR_CASE_CHAPT,
    courtDivisionCode: raw.CASE_DIV.toString().padStart(3, '0'),
    closedByCourtDate: raw.CLOSED_BY_COURT_DATE,
    closedByUstDate: raw.CLOSED_BY_UST_DATE,
    reopenedDate: raw.REOPENED_DATE,
  };
}

// Shared date/field mapping used by both the normal write path (writeRecord) and
// the moved-case migration path (buildCaseAppointmentMigrationInput) in
// migrate-case-appointments.ts. Throws if any ACMS date field is malformed, or if
// chapter is not a value CAMS recognizes (e.g. 'AC') — callers are responsible for catching.
export function buildAppointmentFields(
  record: AcmsCaseAppointmentRecord,
): Partial<CaseAppointmentInput> {
  const closedDate = record.closedByCourtDate
    ? formatAcmsDate(record.closedByCourtDate)
    : record.closedByUstDate
      ? formatAcmsDate(record.closedByUstDate)
      : undefined;
  return {
    ...(record.apptDate ? { appointedDate: formatAcmsDate(record.apptDate) } : {}),
    ...(record.unassignDate ? { unassignedOn: formatAcmsDate(record.unassignDate) } : {}),
    ...(record.caseFiledDate ? { dateFiled: formatAcmsDate(record.caseFiledDate) } : {}),
    ...(record.chapter ? { chapter: normalizeAcmsCaseChapter(record.chapter) } : {}),
    ...(record.courtDivisionCode ? { courtDivisionCode: record.courtDivisionCode } : {}),
    ...(closedDate ? { closedDate } : {}),
    ...(record.reopenedDate ? { reopenedDate: formatAcmsDate(record.reopenedDate) } : {}),
  };
}
