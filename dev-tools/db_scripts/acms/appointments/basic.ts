/**
 * Script: acms/appointments/basic
 * Database: acms
 *
 * Seeds two CMMAP rows for the seed professional (NY-99901):
 *   - One historical appointment (disposed) to verify appointment history retrieval
 *   - One active appointment (no dispose date) to represent a current assignment
 *
 * RECORD_SEQ_NBR is per-case (PK is compound: CASE_DIV+CASE_YEAR+CASE_NUMBER+RECORD_SEQ_NBR).
 * Seed cases use CASE_NUMBER in the 90000–99999 range matching the DXTR seed range.
 * Dates are stored as YYYYMMDD integers per ACMS convention.
 * Links to CMMPR row seeded by acms/professionals/basic.ts (PROF_CODE=99901, GROUP_DESIGNATOR=NY).
 */

export const db = 'acms';
export const collectionOrTable = 'CMMAP';
export const primaryKey = ['CASE_DIV', 'CASE_YEAR', 'CASE_NUMBER', 'RECORD_SEQ_NBR'];
export const insertOnly = true;

export const data = [
  {
    RECORD_SEQ_NBR: 1,
    CASE_DIV: 81,
    CASE_YEAR: 25,
    CASE_NUMBER: 90001,
    GROUP_DESIGNATOR: 'NY',
    PROF_CODE: 99901,
    APPT_TYPE: 'TR',
    APPT_DATE: 20250101,
    DISP_DATE: 20250601,
    DELETE_CODE: ' ',
    APPTEE_ACTIVE: 'Y',
  },
  {
    RECORD_SEQ_NBR: 1,
    CASE_DIV: 81,
    CASE_YEAR: 25,
    CASE_NUMBER: 90002,
    GROUP_DESIGNATOR: 'NY',
    PROF_CODE: 99901,
    APPT_TYPE: 'TR',
    APPT_DATE: 20250601,
    DISP_DATE: 0,
    DELETE_CODE: ' ',
    APPTEE_ACTIVE: 'Y',
  },
];
