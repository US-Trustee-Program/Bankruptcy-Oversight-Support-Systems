import { AcmsCaseAppointmentRawRecord, AcmsCaseAppointmentRecord } from '../gateways.types';
import {
  buildAcmsSourceTrustee,
  buildAppointmentFields,
  formatAcmsDate,
  rawToAppointmentRecord,
  rawToTrusteeAppointmentSyncEvent,
} from './acms-case-appointment.helpers';

function makeRawRecord(
  override: Partial<AcmsCaseAppointmentRawRecord> = {},
): AcmsCaseAppointmentRawRecord {
  return {
    id: 1001,
    CASE_DIV: 81,
    CASE_YEAR: 24,
    CASE_NUMBER: 12345,
    GROUP_DESIGNATOR: 'NY',
    PROF_CODE: 63,
    APPT_DATE: 20200101,
    DISP_DATE: null,
    CASE_FILED_DATE: 20190110,
    CURR_CASE_CHAPT: '7',
    CLOSED_BY_COURT_DATE: null,
    CLOSED_BY_UST_DATE: null,
    REOPENED_DATE: null,
    REGION_CODE: '02',
    CDB_UPDATE_DATE: 20200101,
    PROF_FIRST_NAME: 'Jane',
    PROF_LAST_NAME: 'Doe',
    PROF_MI: '',
    PROF_ADDRESS1: '123 Main St',
    PROF_ADDRESS2: '',
    PROF_CITY: 'Anytown',
    PROF_STATE: 'NY',
    PROF_ZIP: 100010000,
    PROF_COMMERCIAL_PHONE_NBR: 2125551234,
    ...override,
  };
}

function makeAppointmentRecord(
  override: Partial<AcmsCaseAppointmentRecord> = {},
): AcmsCaseAppointmentRecord {
  return {
    id: 1001,
    caseId: '081-24-12345',
    acmsProfessionalId: 'NY-00063',
    assignDate: 20200101,
    apptDate: 20200101,
    unassignDate: null,
    caseFiledDate: 20190110,
    chapter: '7',
    courtDivisionCode: '081',
    closedByCourtDate: null,
    closedByUstDate: null,
    reopenedDate: null,
    ...override,
  };
}

describe('formatAcmsDate', () => {
  test('formats an 8-digit YYYYMMDD integer as an ISO date', () => {
    expect(formatAcmsDate(20200615)).toBe('2020-06-15');
  });

  test('throws for a value with fewer than 8 digits', () => {
    expect(() => formatAcmsDate(202)).toThrow('Invalid ACMS date format');
  });

  test('throws for a value that is not a real calendar date', () => {
    expect(() => formatAcmsDate(20200231)).toThrow('Invalid date');
  });

  test('throws for a negative value with 8 characters', () => {
    expect(() => formatAcmsDate(-1000000)).toThrow('Invalid ACMS date format');
  });

  test('throws for a month outside the valid calendar range', () => {
    expect(() => formatAcmsDate(20201301)).toThrow('Invalid date');
  });
});

describe('rawToAppointmentRecord', () => {
  test('maps raw CMMAP component fields to a formatted appointment record', () => {
    const record = rawToAppointmentRecord(makeRawRecord());

    expect(record).toEqual({
      id: 1001,
      caseId: '081-24-12345',
      acmsProfessionalId: 'NY-00063',
      assignDate: 20200101,
      apptDate: 20200101,
      unassignDate: null,
      caseFiledDate: 20190110,
      chapter: '7',
      courtDivisionCode: '081',
      closedByCourtDate: null,
      closedByUstDate: null,
      reopenedDate: null,
    });
  });

  test('sets apptDate to null when APPT_DATE is 0', () => {
    const record = rawToAppointmentRecord(makeRawRecord({ APPT_DATE: 0 }));

    expect(record.apptDate).toBeNull();
    expect(record.assignDate).toBe(0);
  });

  test('formats caseId and acmsProfessionalId from component fields', () => {
    const record = rawToAppointmentRecord(
      makeRawRecord({
        CASE_DIV: 9,
        CASE_YEAR: 5,
        CASE_NUMBER: 99,
        GROUP_DESIGNATOR: 'CA',
        PROF_CODE: 7,
      }),
    );

    expect(record.caseId).toBe('009-05-00099');
    expect(record.acmsProfessionalId).toBe('CA-00007');
    expect(record.courtDivisionCode).toBe('009');
  });

  test('passes through non-null disposition, close, and reopened dates', () => {
    const record = rawToAppointmentRecord(
      makeRawRecord({
        DISP_DATE: 20210301,
        CLOSED_BY_COURT_DATE: 20220101,
        CLOSED_BY_UST_DATE: 20220201,
        REOPENED_DATE: 20230101,
      }),
    );

    expect(record.unassignDate).toBe(20210301);
    expect(record.closedByCourtDate).toBe(20220101);
    expect(record.closedByUstDate).toBe(20220201);
    expect(record.reopenedDate).toBe(20230101);
  });
});

describe('buildAppointmentFields', () => {
  test('includes appointedDate, dateFiled and normalized chapter when present', () => {
    const fields = buildAppointmentFields(
      makeAppointmentRecord({ apptDate: 20200620, caseFiledDate: 20190110, chapter: '09' }),
    );

    expect(fields).toEqual(
      expect.objectContaining({
        appointedDate: '2020-06-20',
        dateFiled: '2019-01-10',
        chapter: '9',
        courtDivisionCode: '081',
      }),
    );
  });

  test('omits appointedDate when apptDate is null', () => {
    const fields = buildAppointmentFields(makeAppointmentRecord({ apptDate: null }));

    expect(fields).not.toHaveProperty('appointedDate');
  });

  test('omits unassignedOn when unassignDate is null', () => {
    const fields = buildAppointmentFields(makeAppointmentRecord({ unassignDate: null }));

    expect(fields).not.toHaveProperty('unassignedOn');
  });

  test('omits dateFiled when caseFiledDate is null', () => {
    const fields = buildAppointmentFields(makeAppointmentRecord({ caseFiledDate: null }));

    expect(fields).not.toHaveProperty('dateFiled');
  });

  test('omits chapter when chapter is null', () => {
    const fields = buildAppointmentFields(makeAppointmentRecord({ chapter: null }));

    expect(fields).not.toHaveProperty('chapter');
  });

  test('includes unassignedOn when unassignDate is present', () => {
    const fields = buildAppointmentFields(makeAppointmentRecord({ unassignDate: 20200901 }));

    expect(fields.unassignedOn).toBe('2020-09-01');
  });

  test('prefers closedByCourtDate over closedByUstDate for closedDate', () => {
    const fields = buildAppointmentFields(
      makeAppointmentRecord({ closedByCourtDate: 20210101, closedByUstDate: 20210201 }),
    );

    expect(fields.closedDate).toBe('2021-01-01');
  });

  test('falls back to closedByUstDate when closedByCourtDate is absent', () => {
    const fields = buildAppointmentFields(
      makeAppointmentRecord({ closedByCourtDate: null, closedByUstDate: 20210201 }),
    );

    expect(fields.closedDate).toBe('2021-02-01');
  });

  test('omits closedDate when neither closed date is present', () => {
    const fields = buildAppointmentFields(
      makeAppointmentRecord({ closedByCourtDate: null, closedByUstDate: null }),
    );

    expect(fields).not.toHaveProperty('closedDate');
  });

  test('includes reopenedDate when present', () => {
    const fields = buildAppointmentFields(makeAppointmentRecord({ reopenedDate: 20220501 }));

    expect(fields.reopenedDate).toBe('2022-05-01');
  });

  test('throws for an unrecognized ACMS chapter', () => {
    expect(() => buildAppointmentFields(makeAppointmentRecord({ chapter: 'AC' }))).toThrow(
      'Invalid ACMS chapter value',
    );
  });
});

describe('buildAcmsSourceTrustee', () => {
  test('builds fullName and legacy contact fields from CMMPR fields', () => {
    const sourceTrustee = buildAcmsSourceTrustee(makeRawRecord());

    expect(sourceTrustee).toEqual({
      firstName: 'Jane',
      middleName: undefined,
      lastName: 'Doe',
      fullName: 'Jane Doe',
      legacy: {
        address1: '123 Main St',
        address2: undefined,
        cityStateZipCountry: 'Anytown NY 10001-0000',
        phone: '2125551234',
      },
    });
  });

  test('includes middle initial in fullName when present', () => {
    const sourceTrustee = buildAcmsSourceTrustee(makeRawRecord({ PROF_MI: 'Q' }));

    expect(sourceTrustee.middleName).toBe('Q');
    expect(sourceTrustee.fullName).toBe('Jane Q Doe');
  });

  test('treats a phone of 0 as absent', () => {
    const sourceTrustee = buildAcmsSourceTrustee(makeRawRecord({ PROF_COMMERCIAL_PHONE_NBR: 0 }));

    expect(sourceTrustee.legacy?.phone).toBeUndefined();
  });

  test('never sets email or fax (no such columns on this query)', () => {
    const sourceTrustee = buildAcmsSourceTrustee(makeRawRecord());

    expect(sourceTrustee.legacy?.email).toBeUndefined();
    expect(sourceTrustee.legacy?.fax).toBeUndefined();
  });

  test('omits legacy entirely when address, city/state/zip, and phone are all blank', () => {
    const sourceTrustee = buildAcmsSourceTrustee(
      makeRawRecord({
        PROF_ADDRESS1: '',
        PROF_ADDRESS2: '',
        PROF_CITY: '',
        PROF_STATE: '',
        PROF_ZIP: 0,
        PROF_COMMERCIAL_PHONE_NBR: 0,
      }),
    );

    expect(sourceTrustee.legacy).toBeUndefined();
  });

  test('collapses extra spaces when middle initial is blank', () => {
    const sourceTrustee = buildAcmsSourceTrustee(makeRawRecord({ PROF_MI: '' }));

    expect(sourceTrustee.fullName).toBe('Jane Doe');
  });
});

describe('rawToTrusteeAppointmentSyncEvent', () => {
  test('maps a raw record and courtId into a source-neutral ACMS sync event', () => {
    const event = rawToTrusteeAppointmentSyncEvent(makeRawRecord(), '0208');

    expect(event).toEqual({
      caseId: '081-24-12345',
      courtId: '0208',
      source: 'ACMS',
      sourceTrustee: buildAcmsSourceTrustee(makeRawRecord()),
      acmsProfessionalId: 'NY-00063',
      groupDesignator: 'NY',
      profCode: '63',
      appointedDate: '2020-01-01',
      chapter: '7',
      courtDivisionCode: '081',
    });
  });

  test('omits appointedDate when APPT_DATE is 0', () => {
    const event = rawToTrusteeAppointmentSyncEvent(makeRawRecord({ APPT_DATE: 0 }), '0208');

    expect(event).not.toHaveProperty('appointedDate');
  });

  test('includes unassignedOn when DISP_DATE is present and non-zero', () => {
    const event = rawToTrusteeAppointmentSyncEvent(makeRawRecord({ DISP_DATE: 20210301 }), '0208');

    expect(event.unassignedOn).toBe('2021-03-01');
  });

  test('omits unassignedOn when DISP_DATE is null', () => {
    const event = rawToTrusteeAppointmentSyncEvent(makeRawRecord({ DISP_DATE: null }), '0208');

    expect(event).not.toHaveProperty('unassignedOn');
  });

  test('omits chapter when CURR_CASE_CHAPT is null', () => {
    const event = rawToTrusteeAppointmentSyncEvent(
      makeRawRecord({ CURR_CASE_CHAPT: null }),
      '0208',
    );

    expect(event).not.toHaveProperty('chapter');
  });

  test('normalizes a zero-padded chapter', () => {
    const event = rawToTrusteeAppointmentSyncEvent(
      makeRawRecord({ CURR_CASE_CHAPT: '09' }),
      '0208',
    );

    expect(event.chapter).toBe('9');
  });
});
