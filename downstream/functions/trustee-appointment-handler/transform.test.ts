import { describe, test, expect } from 'vitest';
import {
  parseCaseId,
  toAcmsDateNumeric,
  transformTrusteeToStagingRow,
  type TrusteeAppointmentDownstreamEvent,
} from './transform';

const baseEvent: TrusteeAppointmentDownstreamEvent = {
  caseId: '081-24-12345',
  trusteeId: 'trustee-abc123',
  acmsProfessionalId: 'NY-00063',
  apptType: 'TR',
  assignedOn: '2024-11-15T10:00:00Z',
  chapter: '7',
};

describe('parseCaseId', () => {
  test('parses valid CAMS case ID', () => {
    expect(parseCaseId('081-24-12345')).toEqual({ div: 81, year: 24, number: 12345 });
  });

  test('parses case ID with leading zeros', () => {
    expect(parseCaseId('001-00-00001')).toEqual({ div: 1, year: 0, number: 1 });
  });

  test('throws on invalid format — wrong segment lengths', () => {
    expect(() => parseCaseId('81-24-12345')).toThrow('Invalid CAMS case ID format');
    expect(() => parseCaseId('081-2-12345')).toThrow('Invalid CAMS case ID format');
    expect(() => parseCaseId('081-24-1234')).toThrow('Invalid CAMS case ID format');
  });

  test('throws on non-numeric segments', () => {
    expect(() => parseCaseId('ABC-24-12345')).toThrow('Invalid CAMS case ID format');
  });
});

describe('toAcmsDateNumeric', () => {
  test('converts ISO timestamp to YYYYMMDD', () => {
    expect(toAcmsDateNumeric('2024-11-15T10:30:00Z')).toBe(20241115);
    expect(toAcmsDateNumeric('2024-01-05T00:00:00Z')).toBe(20240105);
  });

  test('handles date-only strings', () => {
    expect(toAcmsDateNumeric('2024-11-15')).toBe(20241115);
  });

  test('uses date portion from offset timestamps', () => {
    expect(toAcmsDateNumeric('2024-11-15T00:00:00-05:00')).toBe(20241115);
  });
});

describe('transformTrusteeToStagingRow', () => {
  test('active appointment sets APPT_DISP to GR', () => {
    const result = transformTrusteeToStagingRow(baseEvent);
    expect(result.APPT_DISP).toBe('GR');
    expect(result.APPTEE_ACTIVE).toBe('Y');
    expect(result.DISP_DATE).toBeNull();
    expect(result.DISP_DATE_DT).toBeNull();
  });

  test('closed appointment sets APPT_DISP to WD', () => {
    const result = transformTrusteeToStagingRow({
      ...baseEvent,
      unassignedOn: '2024-11-20T15:30:00Z',
    });
    expect(result.APPT_DISP).toBe('WD');
    expect(result.APPTEE_ACTIVE).toBe('N');
    expect(result.DISP_DATE).toBe(20241120);
    expect(result.DISP_DATE_DT).toEqual(new Date('2024-11-20T15:30:00Z'));
  });

  test('APPT_DATE uses appointedDate when present', () => {
    const result = transformTrusteeToStagingRow({ ...baseEvent, appointedDate: '2024-09-01' });
    expect(result.APPT_DATE).toBe(20240901);
    expect(result.APPT_DATE_DT).toEqual(new Date('2024-09-01'));
  });

  test('APPT_DATE falls back to assignedOn when appointedDate absent', () => {
    const result = transformTrusteeToStagingRow(baseEvent);
    expect(result.APPT_DATE).toBe(20241115);
    expect(result.APPT_DATE_DT).toEqual(new Date('2024-11-15T10:00:00Z'));
  });

  test('parses acmsProfessionalId into PROF_CODE and GROUP_DESIGNATOR', () => {
    const result = transformTrusteeToStagingRow({ ...baseEvent, acmsProfessionalId: 'NY-00063' });
    expect(result.GROUP_DESIGNATOR).toBe('NY');
    expect(result.PROF_CODE).toBe(63);
  });

  test('handles multi-character group designators', () => {
    const result = transformTrusteeToStagingRow({ ...baseEvent, acmsProfessionalId: 'UT-05321' });
    expect(result.GROUP_DESIGNATOR).toBe('UT');
    expect(result.PROF_CODE).toBe(5321);
  });

  test('maps case ID fields correctly', () => {
    const result = transformTrusteeToStagingRow(baseEvent);
    expect(result.CASE_DIV).toBe(81);
    expect(result.CASE_YEAR).toBe(24);
    expect(result.CASE_NUMBER).toBe(12345);
    expect(result.CAMS_CASE_ID).toBe('081-24-12345');
  });

  test('APPT_TYPE is always TR', () => {
    expect(transformTrusteeToStagingRow(baseEvent).APPT_TYPE).toBe('TR');
  });

  test('ALPHA_SEARCH is null', () => {
    expect(transformTrusteeToStagingRow(baseEvent).ALPHA_SEARCH).toBeNull();
  });

  test('CAMS_USER_ID and CAMS_USER_NAME are CAMS', () => {
    const result = transformTrusteeToStagingRow(baseEvent);
    expect(result.CAMS_USER_ID).toBe('CAMS');
    expect(result.CAMS_USER_NAME).toBe('CAMS');
    expect(result.USER_ID).toBe('CAMS');
  });

  test('SOURCE is CAMS', () => {
    expect(transformTrusteeToStagingRow(baseEvent).SOURCE).toBe('CAMS');
  });

  test('sets nullable fields to null', () => {
    const result = transformTrusteeToStagingRow(baseEvent);
    expect(result.COMMENTS).toBeNull();
    expect(result.HEARING_SEQUENCE).toBeNull();
    expect(result.REGION_CODE).toBeNull();
    expect(result.RGN_CREATE_DATE).toBeNull();
    expect(result.RGN_CREATE_DATE_DT).toBeNull();
  });

  test('RECORD_SEQ_NBR is always 1', () => {
    expect(transformTrusteeToStagingRow(baseEvent).RECORD_SEQ_NBR).toBe(1);
  });

  test('DELETE_CODE is a single space', () => {
    expect(transformTrusteeToStagingRow(baseEvent).DELETE_CODE).toBe(' ');
  });
});
