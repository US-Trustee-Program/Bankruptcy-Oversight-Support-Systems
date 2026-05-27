/**
 * Script: acms/professionals/basic
 * Database: acms
 *
 * Seeds one basic professional record in the ACMS CMMPR table.
 * Used to verify that the ACMS gateway integration is reachable and
 * returns data through the CAMS backend.
 *
 * UST_PROF_CODE 99901 is reserved for seed data (mirrors the 9xxxx
 * seed range convention used for DXTR case IDs).
 */

export const db = 'acms';
export const collectionOrTable = 'CMMPR';
export const primaryKey = ['PROF_CODE', 'GROUP_DESIGNATOR'];
export const insertOnly = true;

export const data = [
  {
    PROF_CODE: 99901,
    GROUP_DESIGNATOR: 'NY',
    DELETE_CODE: ' ',
    PROF_LAST_NAME: 'Seedprofessional',
    PROF_FIRST_NAME: 'Sam',
    PROF_MI: '',
    PROF_ADDRESS1: '500 Seed Professional Ave',
    PROF_ADDRESS2: '',
    PROF_CITY: 'New York',
    PROF_STATE: 'NY',
    PROF_ZIP: 100010000,
    UPDATE_DATE: '2025-04-01T00:00:00',
  },
];
