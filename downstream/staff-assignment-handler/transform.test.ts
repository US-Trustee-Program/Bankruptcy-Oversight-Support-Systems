import { describe, test, expect } from 'vitest';
import {
  parseCaseId,
  toAcmsDateNumeric,
  extractLastName,
  transformToStagingRow,
  type CaseAssignmentDownstreamEvent,
} from './transform';

const baseEvent: CaseAssignmentDownstreamEvent = {
  caseId: '081-24-12345',
  userId: 'user-12345',
  name: 'John Q. Smith',
  role: 'TrialAttorney',
  assignedOn: '2024-11-15T10:00:00Z',
  documentType: 'ASSIGNMENT',
  acmsProfessionalId: 'NY-00063',
};

describe('parseCaseId', () => {
  test('parses valid CAMS case ID', () => {
    expect(parseCaseId('081-24-12345')).toEqual({ div: 81, year: 24, number: 12345 });
  });

  test('parses case ID with leading zeros', () => {
    expect(parseCaseId('001-00-00001')).toEqual({ div: 1, year: 0, number: 1 });
  });

  test('throws on invalid format', () => {
    expect(() => parseCaseId('81-24-12345')).toThrow('Invalid CAMS case ID format');
    expect(() => parseCaseId('081-2-12345')).toThrow('Invalid CAMS case ID format');
    expect(() => parseCaseId('081-24-1234')).toThrow('Invalid CAMS case ID format');
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

describe('extractLastName', () => {
  test('extracts last word uppercased', () => {
    expect(extractLastName('John Smith')).toBe('SMITH');
    expect(extractLastName('Jane Marie Doe')).toBe('DOE');
  });

  test('handles hyphenated names', () => {
    expect(extractLastName('Maria Garcia-Rodriguez')).toBe('GARCIA-RODRIGUEZ');
  });

  test('trims whitespace', () => {
    expect(extractLastName('  John Smith  ')).toBe('SMITH');
  });
});

describe('transformToStagingRow', () => {
  test('active assignment sets APPT_DISP to AP', () => {
    const result = transformToStagingRow(baseEvent);
    expect(result.APPT_DISP).toBe('AP');
    expect(result.APPTEE_ACTIVE).toBe('Y');
    expect(result.DISP_DATE).toBeNull();
    expect(result.DISP_DATE_DT).toBeNull();
  });

  test('unassigned event sets APPT_DISP to WD', () => {
    const result = transformToStagingRow({ ...baseEvent, unassignedOn: '2024-11-20T15:30:00Z' });
    expect(result.APPT_DISP).toBe('WD');
    expect(result.APPTEE_ACTIVE).toBe('N');
    expect(result.DISP_DATE).toBe(20241120);
    expect(result.DISP_DATE_DT).toEqual(new Date('2024-11-20T15:30:00Z'));
  });

  test('parses acmsProfessionalId into PROF_CODE and GROUP_DESIGNATOR', () => {
    const result = transformToStagingRow({ ...baseEvent, acmsProfessionalId: 'NY-00063' });
    expect(result.GROUP_DESIGNATOR).toBe('NY');
    expect(result.PROF_CODE).toBe(63);
  });

  test('handles multi-character group designators', () => {
    const result = transformToStagingRow({ ...baseEvent, acmsProfessionalId: 'UT-05321' });
    expect(result.GROUP_DESIGNATOR).toBe('UT');
    expect(result.PROF_CODE).toBe(5321);
  });

  test('throws when acmsProfessionalId is null', () => {
    expect(() => transformToStagingRow({ ...baseEvent, acmsProfessionalId: null })).toThrow(
      'Cannot transform event: acmsProfessionalId is null for caseId 081-24-12345',
    );
  });

  test('maps case ID fields correctly', () => {
    const result = transformToStagingRow(baseEvent);
    expect(result.CASE_DIV).toBe(81);
    expect(result.CASE_YEAR).toBe(24);
    expect(result.CASE_NUMBER).toBe(12345);
    expect(result.CAMS_CASE_ID).toBe('081-24-12345');
  });

  test('sets APPT_TYPE to S1', () => {
    expect(transformToStagingRow(baseEvent).APPT_TYPE).toBe('S1');
  });

  test('sets CAMS metadata fields', () => {
    const result = transformToStagingRow(baseEvent);
    expect(result.SOURCE).toBe('CAMS');
    expect(result.CAMS_USER_ID).toBe('user-12345');
    expect(result.CAMS_USER_NAME).toBe('John Q. Smith');
    expect(result.USER_ID).toBe('CAMS');
  });

  test('sets ALPHA_SEARCH from last name', () => {
    expect(transformToStagingRow(baseEvent).ALPHA_SEARCH).toBe('SMITH');
  });

  test('sets APPT_DATE correctly', () => {
    const result = transformToStagingRow(baseEvent);
    expect(result.APPT_DATE).toBe(20241115);
    expect(result.APPT_DATE_DT).toEqual(new Date('2024-11-15T10:00:00Z'));
  });

  test('sets nullable fields to null for Ch15', () => {
    const result = transformToStagingRow(baseEvent);
    expect(result.COMMENTS).toBeNull();
    expect(result.HEARING_SEQUENCE).toBeNull();
    expect(result.REGION_CODE).toBeNull();
    expect(result.RGN_CREATE_DATE).toBeNull();
    expect(result.RGN_CREATE_DATE_DT).toBeNull();
  });
});
