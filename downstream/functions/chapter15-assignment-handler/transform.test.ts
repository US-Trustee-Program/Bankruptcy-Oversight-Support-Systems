import { describe, test, expect } from 'vitest';
import {
  parseCaseId,
  toAcmsDateNumeric,
  extractLastName,
  generateProfessionalCode,
  transformToStagingRow,
  type CaseAssignmentEvent,
} from './transform';

describe('parseCaseId', () => {
  test('should parse valid CAMS case ID', () => {
    const result = parseCaseId('081-24-12345');
    expect(result).toEqual({
      div: 81,
      year: 24,
      number: 12345,
    });
  });

  test('should parse case ID with leading zeros', () => {
    const result = parseCaseId('001-00-00001');
    expect(result).toEqual({
      div: 1,
      year: 0,
      number: 1,
    });
  });

  test('should throw error for invalid format', () => {
    expect(() => parseCaseId('81-24-12345')).toThrow('Invalid CAMS case ID format');
    expect(() => parseCaseId('081-2-12345')).toThrow('Invalid CAMS case ID format');
    expect(() => parseCaseId('081-24-1234')).toThrow('Invalid CAMS case ID format');
    expect(() => parseCaseId('ABC-24-12345')).toThrow('Invalid CAMS case ID format');
  });
});

describe('toAcmsDateNumeric', () => {
  test('should convert ISO date to YYYYMMDD numeric', () => {
    expect(toAcmsDateNumeric('2024-11-15T10:30:00Z')).toBe(20241115);
    expect(toAcmsDateNumeric('2024-01-05T00:00:00Z')).toBe(20240105);
    expect(toAcmsDateNumeric('2025-12-31T23:59:59Z')).toBe(20251231);
  });

  test('should handle dates without time component', () => {
    expect(toAcmsDateNumeric('2024-11-15')).toBe(20241115);
  });

  test('should handle different timezones correctly', () => {
    // Date should be consistent regardless of timezone in input
    const result = toAcmsDateNumeric('2024-11-15T00:00:00-05:00');
    expect(result).toBe(20241115);
  });
});

describe('extractLastName', () => {
  test('should extract last word as last name', () => {
    expect(extractLastName('John Smith')).toBe('SMITH');
    expect(extractLastName('Jane Marie Doe')).toBe('DOE');
    expect(extractLastName('Maria Garcia-Rodriguez')).toBe('GARCIA-RODRIGUEZ');
  });

  test('should handle single name', () => {
    expect(extractLastName('Madonna')).toBe('MADONNA');
  });

  test('should trim whitespace', () => {
    expect(extractLastName('  John Smith  ')).toBe('SMITH');
    expect(extractLastName('John  Smith')).toBe('SMITH');
  });

  test('should uppercase result', () => {
    expect(extractLastName('john smith')).toBe('SMITH');
    expect(extractLastName('Jane marie DOE')).toBe('DOE');
  });
});

describe('generateProfessionalCode', () => {
  test('should generate consistent code for same user ID', () => {
    const result1 = generateProfessionalCode('user-12345');
    const result2 = generateProfessionalCode('user-12345');

    expect(result1).toEqual(result2);
  });

  test('should generate different codes for different user IDs', () => {
    const result1 = generateProfessionalCode('user-12345');
    const result2 = generateProfessionalCode('user-67890');

    expect(result1.code).not.toBe(result2.code);
  });

  test('should generate 5-digit code', () => {
    const result = generateProfessionalCode('user-12345');

    expect(result.code).toBeGreaterThanOrEqual(0);
    expect(result.code).toBeLessThan(100000);
  });

  test('should use ZZ placeholder group', () => {
    const result = generateProfessionalCode('user-12345');

    expect(result.group).toBe('ZZ');
  });
});

describe('transformToStagingRow', () => {
  const baseEvent: CaseAssignmentEvent = {
    caseId: '081-24-12345',
    userId: 'user-12345',
    name: 'John Q. Smith',
    role: 'TrialAttorney',
    assignedOn: '2024-11-15T10:00:00Z',
  };

  test('should transform assignment event to staging row', () => {
    const result = transformToStagingRow(baseEvent);

    expect(result.DELETE_CODE).toBe(' ');
    expect(result.CASE_DIV).toBe(81);
    expect(result.CASE_YEAR).toBe(24);
    expect(result.CASE_NUMBER).toBe(12345);
    expect(result.RECORD_SEQ_NBR).toBe(1);
    expect(result.APPT_TYPE).toBe('S1');
    expect(result.APPT_DATE).toBe(20241115);
    expect(result.APPTEE_ACTIVE).toBe('Y');
    expect(result.ALPHA_SEARCH).toBe('SMITH');
    expect(result.SOURCE).toBe('CAMS');
    expect(result.CAMS_CASE_ID).toBe('081-24-12345');
    expect(result.CAMS_USER_ID).toBe('user-12345');
    expect(result.CAMS_USER_NAME).toBe('John Q. Smith');
  });

  test('should handle unassigned event', () => {
    const unassignedEvent: CaseAssignmentEvent = {
      ...baseEvent,
      unassignedOn: '2024-11-20T15:30:00Z',
    };

    const result = transformToStagingRow(unassignedEvent);

    expect(result.APPTEE_ACTIVE).toBe('N');
    expect(result.APPT_DISP).toBe('TR');
    expect(result.DISP_DATE).toBe(20241120);
    expect(result.DISP_DATE_DT).toEqual(new Date('2024-11-20T15:30:00Z'));
  });

  test('should not set disposition fields for active assignment', () => {
    const result = transformToStagingRow(baseEvent);

    expect(result.APPT_DISP).toBeNull();
    expect(result.DISP_DATE).toBeNull();
    expect(result.DISP_DATE_DT).toBeNull();
  });

  test('should set professional code placeholder', () => {
    const result = transformToStagingRow(baseEvent);

    expect(result.PROF_CODE).toBeGreaterThan(0);
    expect(result.PROF_CODE).toBeLessThan(100000);
    expect(result.GROUP_DESIGNATOR).toBe('ZZ');
  });

  test('should set APPT_DATE_DT to Date object', () => {
    const result = transformToStagingRow(baseEvent);

    expect(result.APPT_DATE_DT).toBeInstanceOf(Date);
    expect(result.APPT_DATE_DT?.toISOString()).toBe('2024-11-15T10:00:00.000Z');
  });

  test('should set CDB dates to current date', () => {
    const before = new Date();
    const result = transformToStagingRow(baseEvent);
    const after = new Date();

    expect(result.CDB_CREATE_DATE_DT).toBeInstanceOf(Date);
    expect(result.CDB_CREATE_DATE_DT!.getTime()).toBeGreaterThanOrEqual(before.getTime());
    expect(result.CDB_CREATE_DATE_DT!.getTime()).toBeLessThanOrEqual(after.getTime());

    const expectedNumeric = parseInt(
      result.CDB_CREATE_DATE_DT!.toISOString().slice(0, 10).replace(/-/g, ''),
      10,
    );
    expect(result.CDB_CREATE_DATE).toBe(expectedNumeric);
  });

  test('should set USER_ID to CAMS', () => {
    const result = transformToStagingRow(baseEvent);

    expect(result.USER_ID).toBe('CAMS');
  });

  test('should set all nullable fields appropriately', () => {
    const result = transformToStagingRow(baseEvent);

    // Fields that should be null for Chapter 15
    expect(result.COMMENTS).toBeNull();
    expect(result.HEARING_SEQUENCE).toBeNull();
    expect(result.REGION_CODE).toBeNull();
    expect(result.RGN_CREATE_DATE).toBeNull();
    expect(result.RGN_UPDATE_DATE).toBeNull();
    expect(result.RGN_CREATE_DATE_DT).toBeNull();
    expect(result.RGN_UPDATE_DATE_DT).toBeNull();
  });

  test('should extract last name with multiple words', () => {
    const eventWithMiddleName: CaseAssignmentEvent = {
      ...baseEvent,
      name: 'Maria Isabel Garcia Rodriguez',
    };

    const result = transformToStagingRow(eventWithMiddleName);

    expect(result.ALPHA_SEARCH).toBe('RODRIGUEZ');
    expect(result.CAMS_USER_NAME).toBe('Maria Isabel Garcia Rodriguez');
  });

  test('should handle hyphenated last names', () => {
    const eventWithHyphen: CaseAssignmentEvent = {
      ...baseEvent,
      name: 'Mary Smith-Jones',
    };

    const result = transformToStagingRow(eventWithHyphen);

    expect(result.ALPHA_SEARCH).toBe('SMITH-JONES');
  });
});
