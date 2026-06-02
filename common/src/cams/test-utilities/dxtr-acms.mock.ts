import { faker } from '@faker-js/faker';
import { CourtDivisionDetails } from '../courts.js';

type AoDxtrCsRow = {
  CS_CASEID: string;
  COURT_ID: string;
  CS_DIV: string;
  GRP_DES: string;
  CASE_ID: string;
  CS_SHORT_TITLE: string;
  CS_CHAPTER: string;
  CS_DATE_FILED: string;
};

type AoDxtrPyRow = {
  CS_CASEID: string;
  COURT_ID: string;
  PY_ROLE: string;
  PY_LAST_NAME: string;
  PY_FIRST_NAME: string;
  PY_ADDRESS1: string;
  PY_CITY: string;
  PY_STATE: string;
  PY_ZIP: string;
};

type AcmsCmmprRow = {
  PROF_CODE: number;
  GROUP_DESIGNATOR: string;
  PROF_LAST_NAME: string;
  PROF_FIRST_NAME: string;
  PROF_MIDDLE_NAME: string | null;
  SSN: string | null;
  EIN: string | null;
};

type AcmsCmmapRow = {
  RECORD_SEQ_NBR: number;
  CASE_DIV: string;
  CASE_YEAR: number;
  CASE_NUMBER: number;
  PROF_CODE: number;
  GROUP_DESIGNATOR: string;
  APPT_DATE: number;
  DISP_DATE: number;
};

export function toAcmsDate(isoDateString: string): number {
  const [year, month, day] = isoDateString.split('-').map(Number);
  return year * 10000 + month * 100 + day;
}

export function getDxtrCsRow(
  csCaseId: string,
  caseNumber: string,
  chapter: string,
  division: CourtDivisionDetails,
  override?: Partial<AoDxtrCsRow>,
): AoDxtrCsRow {
  const defaults: AoDxtrCsRow = {
    CS_CASEID: csCaseId,
    COURT_ID: division.courtId,
    CS_DIV: division.courtDivisionCode,
    GRP_DES: division.groupDesignator,
    CASE_ID: caseNumber,
    CS_SHORT_TITLE: `${faker.person.lastName()} ${faker.person.lastName()}`,
    CS_CHAPTER: chapter,
    CS_DATE_FILED: faker.date.recent({ days: 365 }).toISOString().split('T')[0],
  };
  return { ...defaults, ...override };
}

export function getDxtrPyRow(
  csCaseId: string,
  courtId: string,
  role: 'db' | 'jd' | 'tr',
  override?: Partial<AoDxtrPyRow>,
): AoDxtrPyRow {
  const defaults: AoDxtrPyRow = {
    CS_CASEID: csCaseId,
    COURT_ID: courtId,
    PY_ROLE: role,
    PY_LAST_NAME: faker.person.lastName(),
    PY_FIRST_NAME: faker.person.firstName(),
    PY_ADDRESS1: faker.location.streetAddress(),
    PY_CITY: faker.location.city(),
    PY_STATE: faker.location.state({ abbreviated: true }),
    PY_ZIP: faker.location.zipCode(),
  };
  return { ...defaults, ...override };
}

export function getAcmsCmmprRow(
  profCode: number,
  groupDesignator: string,
  override?: Partial<AcmsCmmprRow>,
): AcmsCmmprRow {
  const defaults: AcmsCmmprRow = {
    PROF_CODE: profCode,
    GROUP_DESIGNATOR: groupDesignator,
    PROF_LAST_NAME: faker.person.lastName(),
    PROF_FIRST_NAME: faker.person.firstName(),
    PROF_MIDDLE_NAME: null,
    SSN: null,
    EIN: null,
  };
  return { ...defaults, ...override };
}

export function getAcmsCmmapRow(
  profCode: number,
  groupDesignator: string,
  override?: Partial<AcmsCmmapRow>,
): AcmsCmmapRow {
  const recentDate = faker.date.recent({ days: 365 });
  const apptDate = toAcmsDate(recentDate.toISOString().split('T')[0]);
  const defaults: AcmsCmmapRow = {
    RECORD_SEQ_NBR: faker.number.int({ min: 1, max: 999999 }),
    CASE_DIV: faker.string.numeric(3),
    CASE_YEAR: faker.number.int({ min: 2000, max: 2025 }),
    CASE_NUMBER: faker.number.int({ min: 1, max: 99999 }),
    PROF_CODE: profCode,
    GROUP_DESIGNATOR: groupDesignator,
    APPT_DATE: apptDate,
    DISP_DATE: 0,
  };
  return { ...defaults, ...override };
}
