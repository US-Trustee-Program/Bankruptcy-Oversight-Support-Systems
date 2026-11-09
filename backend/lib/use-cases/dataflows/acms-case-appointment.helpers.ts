import {
  AcmsCaseAppointmentRawRecord,
  formatCaseId,
  formatAcmsProfessionalId,
} from '../gateways.types';
import { normalizeAcmsCaseChapter } from '../../adapters/gateways/acms/acms.gateway.helper';
import { AcmsTrusteeProfessional, TrusteeAppointmentSyncEvent } from '@common/cams/dataflow-events';
import { formatCityStateZipCountry, removeExtraSpaces } from '../../adapters/utils/string-helper';
import { formatAcmsZip } from './acms-trustee-variant.helpers';

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

/**
 * Builds the source-neutral trustee shape from a raw CMMPR-joined row. legacy is omitted
 * entirely (not an empty object) when address, city/state/zip, and phone are all blank, matching
 * toAcmsTrusteeProfessional's convention in sync-acms-professional-ids.ts. No email or fax: CMMPR
 * has no email column, and this query does not select PROF_FAX_NBR.
 */
export function buildAcmsSourceTrustee(raw: AcmsCaseAppointmentRawRecord): AcmsTrusteeProfessional {
  const fullName = removeExtraSpaces(
    [raw.PROF_FIRST_NAME, raw.PROF_MI, raw.PROF_LAST_NAME].filter(Boolean).join(' '),
  );
  const cityStateZipCountry = formatCityStateZipCountry(
    raw.PROF_CITY || undefined,
    raw.PROF_STATE || undefined,
    formatAcmsZip(raw.PROF_ZIP),
    undefined,
  );
  // PROF_COMMERCIAL_PHONE_NBR of 0 is ACMS's "no phone" sentinel, not a real number.
  const phone = raw.PROF_COMMERCIAL_PHONE_NBR ? String(raw.PROF_COMMERCIAL_PHONE_NBR) : undefined;
  const address1 = raw.PROF_ADDRESS1 || undefined;
  const address2 = raw.PROF_ADDRESS2 || undefined;
  const hasLegacy = Boolean(address1 || address2 || cityStateZipCountry || phone);

  return {
    firstName: raw.PROF_FIRST_NAME?.trim() || undefined,
    middleName: raw.PROF_MI?.trim() || undefined,
    lastName: raw.PROF_LAST_NAME?.trim() || undefined,
    fullName: fullName ?? '',
    ...(hasLegacy ? { legacy: { address1, address2, cityStateZipCountry, phone } } : {}),
  };
}

/**
 * Maps a raw CMMAP+CMMDB+CMMPR row and its resolved courtId (see AcmsTrusteeAppointmentSource;
 * ACMS has no COURT_ID column) into the source-neutral TrusteeAppointmentSyncEvent shape.
 */
export function rawToTrusteeAppointmentSyncEvent(
  raw: AcmsCaseAppointmentRawRecord,
  courtId: string,
): TrusteeAppointmentSyncEvent {
  const caseId = formatCaseId(raw.CASE_DIV, raw.CASE_YEAR, raw.CASE_NUMBER);
  // CMMDB is INNER JOINed and CASE_FILED_DATE is NOT NULL DEFAULT 0; the query maps 0 to NULL.
  // A filed case without a filed date is bad source data: fail the row (it is dead-lettered)
  // rather than park or default it, the same rule as a missing appointedDate.
  if (!raw.CASE_FILED_DATE) {
    throw new Error(`ACMS case ${caseId} has no CASE_FILED_DATE (CMMAP id ${raw.id}).`);
  }
  return {
    caseId,
    courtId,
    source: 'ACMS',
    sourceTrustee: buildAcmsSourceTrustee(raw),
    acmsProfessionalId: formatAcmsProfessionalId(raw.GROUP_DESIGNATOR, raw.PROF_CODE),
    groupDesignator: raw.GROUP_DESIGNATOR,
    // Zero-padded to 5 digits, matching DXTR's own profCode (a fixed-width 5-char REC substring)
    // -- resolveAcmsProfessionalIdForVerification in sync-trustee-case-appointments.ts crosses
    // groupDesignator+profCode directly with a hyphen, with no padding of its own.
    profCode: String(raw.PROF_CODE).padStart(5, '0'),
    ...(raw.APPT_DATE ? { appointedDate: formatAcmsDate(raw.APPT_DATE) } : {}),
    ...(raw.DISP_DATE ? { unassignedOn: formatAcmsDate(raw.DISP_DATE) } : {}),
    ...(raw.CURR_CASE_CHAPT ? { chapter: normalizeAcmsCaseChapter(raw.CURR_CASE_CHAPT) } : {}),
    courtDivisionCode: raw.CASE_DIV.toString().padStart(3, '0'),
    dateFiled: formatAcmsDate(raw.CASE_FILED_DATE),
  };
}
