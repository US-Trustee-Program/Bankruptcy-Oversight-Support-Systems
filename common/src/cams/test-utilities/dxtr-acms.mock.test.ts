import {
  toAcmsDate,
  getDxtrCsRow,
  getDxtrPyRow,
  getAcmsCmmprRow,
  getAcmsCmmapRow,
} from './dxtr-acms.mock';
import { CourtDivisionDetails } from '../courts';

const SAMPLE_DIVISION: CourtDivisionDetails = {
  officeName: 'Manhattan',
  officeCode: '1',
  courtId: '081-',
  courtName: 'Southern District of New York',
  courtDivisionCode: '081',
  courtDivisionName: 'Manhattan',
  groupDesignator: 'NY',
  regionId: '02',
  regionName: 'NEW YORK',
  state: 'NY',
};

test('toAcmsDate converts ISO date string to YYYYMMDD integer', () => {
  expect(toAcmsDate('2025-01-15')).toBe(20250115);
});

test('getDxtrCsRow derives COURT_ID, CS_DIV, and GRP_DES from division', () => {
  const row = getDxtrCsRow('12345', '25-00001', '11', SAMPLE_DIVISION);
  expect(row.COURT_ID).toBe(SAMPLE_DIVISION.courtId);
  expect(row.CS_DIV).toBe(SAMPLE_DIVISION.courtDivisionCode);
  expect(row.GRP_DES).toBe(SAMPLE_DIVISION.groupDesignator);
});

test('getDxtrCsRow sets CS_CASEID and CASE_ID and CS_CHAPTER from parameters', () => {
  const row = getDxtrCsRow('99999', '25-00042', '7', SAMPLE_DIVISION);
  expect(row.CS_CASEID).toBe('99999');
  expect(row.CASE_ID).toBe('25-00042');
  expect(row.CS_CHAPTER).toBe('7');
});

test('getDxtrCsRow override merges correctly', () => {
  const override = { CS_SHORT_TITLE: 'Override Title', CS_DATE_FILED: '2024-06-01' };
  const row = getDxtrCsRow('12345', '25-00001', '11', SAMPLE_DIVISION, override);
  expect(row.CS_SHORT_TITLE).toBe('Override Title');
  expect(row.CS_DATE_FILED).toBe('2024-06-01');
  expect(row.COURT_ID).toBe(SAMPLE_DIVISION.courtId);
});

test('getDxtrCsRow produces different CS_SHORT_TITLE on consecutive calls', () => {
  const titles = new Set(
    Array.from(
      { length: 10 },
      () => getDxtrCsRow('12345', '25-00001', '11', SAMPLE_DIVISION).CS_SHORT_TITLE,
    ),
  );
  expect(titles.size).toBeGreaterThan(1);
});

test('getDxtrPyRow sets PY_ROLE, CS_CASEID, and COURT_ID from parameters', () => {
  const row = getDxtrPyRow('55555', '081-', 'tr');
  expect(row.PY_ROLE).toBe('tr');
  expect(row.CS_CASEID).toBe('55555');
  expect(row.COURT_ID).toBe('081-');
});

test('getDxtrPyRow produces different name and address on consecutive calls', () => {
  const lastNames = new Set(
    Array.from({ length: 10 }, () => getDxtrPyRow('1', '2', 'db').PY_LAST_NAME),
  );
  const addresses = new Set(
    Array.from({ length: 10 }, () => getDxtrPyRow('1', '2', 'jd').PY_ADDRESS1),
  );
  expect(lastNames.size).toBeGreaterThan(1);
  expect(addresses.size).toBeGreaterThan(1);
});

test('getDxtrPyRow override merges correctly', () => {
  const row = getDxtrPyRow('12345', '081-', 'tr', { PY_CITY: 'TestCity' });
  expect(row.PY_CITY).toBe('TestCity');
  expect(row.PY_ROLE).toBe('tr');
});

test('getAcmsCmmprRow returns default values for PROF_CODE, GROUP_DESIGNATOR, and nulls', () => {
  const row = getAcmsCmmprRow();
  expect(row.PROF_CODE).toBe(99901);
  expect(row.GROUP_DESIGNATOR).toBe('NY');
  expect(row.PROF_MIDDLE_NAME).toBeNull();
  expect(row.SSN).toBeNull();
  expect(row.EIN).toBeNull();
});

test('getAcmsCmmprRow produces different names on consecutive calls', () => {
  const lastNames = new Set(Array.from({ length: 10 }, () => getAcmsCmmprRow().PROF_LAST_NAME));
  expect(lastNames.size).toBeGreaterThan(1);
});

test('getAcmsCmmprRow override merges correctly', () => {
  const row = getAcmsCmmprRow({ PROF_CODE: 12345, GROUP_DESIGNATOR: 'CA' });
  expect(row.PROF_CODE).toBe(12345);
  expect(row.GROUP_DESIGNATOR).toBe('CA');
  expect(row.PROF_MIDDLE_NAME).toBeNull();
});

test('getAcmsCmmapRow sets PROF_CODE and GROUP_DESIGNATOR from parameters', () => {
  const row = getAcmsCmmapRow(99901, 'NY');
  expect(row.PROF_CODE).toBe(99901);
  expect(row.GROUP_DESIGNATOR).toBe('NY');
});

test('getAcmsCmmapRow with DISP_DATE override sets that field correctly', () => {
  const row = getAcmsCmmapRow(99901, 'NY', { DISP_DATE: 20250615 });
  expect(row.DISP_DATE).toBe(20250615);
});

test('getAcmsCmmapRow default DISP_DATE is 0', () => {
  const row = getAcmsCmmapRow(99901, 'NY');
  expect(row.DISP_DATE).toBe(0);
});

test('getAcmsCmmapRow APPT_DATE is a valid YYYYMMDD integer by default', () => {
  const row = getAcmsCmmapRow(99901, 'NY');
  expect(row.APPT_DATE).toBeGreaterThan(20000101);
  expect(row.APPT_DATE).toBeLessThanOrEqual(99991231);
});
