import { describe, expect, test } from 'vitest';
import {
  parseChapterAndType,
  parseTodStatus,
  getDivisionOfficeName,
  getCourtId,
  formatPhoneNumber,
  formatZipCode,
  transformTrusteeRecord,
  transformAppointmentRecord,
  getAppointmentKey,
  applyAppointmentOverrides,
} from './ats-mappings';
import { AtsTrusteeRecord, AtsAppointmentRecord } from '../../../../adapters/types/ats.types';
import { AppointmentStatus } from '@common/cams/trustees';

describe('ATS Mappings', () => {
  describe('parseChapterAndType', () => {
    test('should parse standard chapters', () => {
      expect(parseChapterAndType('7')).toEqual({ chapter: '7' });
      expect(parseChapterAndType('11')).toEqual({ chapter: '11' });
      expect(parseChapterAndType('12')).toEqual({ chapter: '12' });
      expect(parseChapterAndType('13')).toEqual({ chapter: '13' });
    });

    test('should handle chapters with leading zeros', () => {
      expect(parseChapterAndType('07')).toEqual({ chapter: '7' });
      expect(parseChapterAndType('011')).toEqual({ chapter: '11' });
    });

    test('should parse special case-by-case chapters', () => {
      expect(parseChapterAndType('12CBC')).toEqual({
        chapter: '12',
        appointmentType: 'case-by-case',
      });
      expect(parseChapterAndType('13CBC')).toEqual({
        chapter: '13',
        appointmentType: 'case-by-case',
      });
    });

    test('should handle case insensitive input', () => {
      expect(parseChapterAndType('12cbc')).toEqual({
        chapter: '12',
        appointmentType: 'case-by-case',
      });
    });

    test('should handle whitespace in chapter codes', () => {
      expect(parseChapterAndType(' 7 ')).toEqual({ chapter: '7' });
      expect(parseChapterAndType(' 12CBC ')).toEqual({
        chapter: '12',
        appointmentType: 'case-by-case',
      });
    });

    test('should throw error for invalid chapters', () => {
      expect(() => parseChapterAndType('99')).toThrow('Unknown chapter code: 99');
      expect(() => parseChapterAndType('')).toThrow('Chapter code is required');
    });
  });

  describe('parseTodStatus', () => {
    test('should parse single letter codes', () => {
      expect(parseTodStatus('P')).toEqual({ appointmentType: 'panel', status: 'active' });
      expect(parseTodStatus('O')).toEqual({ appointmentType: 'converted-case', status: 'active' });
      expect(parseTodStatus('C')).toEqual({ appointmentType: 'case-by-case', status: 'active' });
      expect(parseTodStatus('S')).toEqual({ appointmentType: 'standing', status: 'active' });
    });

    test('should parse two-letter codes', () => {
      expect(parseTodStatus('PA')).toEqual({ appointmentType: 'panel', status: 'active' });
      expect(parseTodStatus('PI')).toEqual({
        appointmentType: 'panel',
        status: 'voluntarily-suspended',
      });
      expect(parseTodStatus('PS')).toEqual({
        appointmentType: 'panel',
        status: 'voluntarily-suspended',
      });
      expect(parseTodStatus('NP')).toEqual({ appointmentType: 'off-panel', status: 'resigned' });
      expect(parseTodStatus('VR')).toEqual({ appointmentType: 'out-of-pool', status: 'resigned' });
      expect(parseTodStatus('OD')).toEqual({ appointmentType: 'off-panel', status: 'deceased' });
    });

    test('should parse numeric codes', () => {
      expect(parseTodStatus('1')).toEqual({ appointmentType: 'case-by-case', status: 'active' });
      expect(parseTodStatus('3')).toEqual({ appointmentType: 'standing', status: 'resigned' });
      expect(parseTodStatus('8')).toEqual({ appointmentType: 'case-by-case', status: 'active' });
      expect(parseTodStatus('9')).toEqual({ appointmentType: 'case-by-case', status: 'inactive' });
    });

    test('should handle case insensitive input', () => {
      expect(parseTodStatus('pa')).toEqual({ appointmentType: 'panel', status: 'active' });
      expect(parseTodStatus('np')).toEqual({ appointmentType: 'off-panel', status: 'resigned' });
      expect(parseTodStatus('vr')).toEqual({ appointmentType: 'out-of-pool', status: 'resigned' });
    });

    test('should return defaults for unknown status', () => {
      expect(parseTodStatus('ZZ')).toEqual({ appointmentType: 'panel', status: 'active' });
      expect(parseTodStatus('')).toEqual({ appointmentType: 'panel', status: 'active' });
    });

    test.each([
      ['P', 'panel', 'active'],
      ['PA', 'panel', 'active'],
      ['O', 'converted-case', 'active'],
      ['C', 'case-by-case', 'active'],
      ['S', 'standing', 'active'],
      ['E', 'elected', 'active'],
      ['V', 'pool', 'active'],
      ['NP', 'off-panel', 'resigned'],
      ['VR', 'out-of-pool', 'resigned'],
      ['PI', 'panel', 'voluntarily-suspended'],
      ['PS', 'panel', 'voluntarily-suspended'],
      ['PV', 'panel', 'voluntarily-suspended'],
      ['PR', 'panel', 'resigned'],
      ['PT', 'panel', 'terminated'],
      ['PD', 'panel', 'deceased'],
      ['OI', 'off-panel', 'inactive'],
      ['OR', 'off-panel', 'resigned'],
      ['OT', 'off-panel', 'terminated'],
      ['OD', 'off-panel', 'deceased'],
      ['CI', 'case-by-case', 'inactive'],
      ['CR', 'case-by-case', 'resigned'],
      ['SI', 'standing', 'inactive'],
      ['SR', 'standing', 'resigned'],
      ['ST', 'standing', 'terminated'],
      ['SD', 'standing', 'deceased'],
    ])(
      'should map letter code "%s" to appointmentType=%s, status=%s',
      (code, expectedType, expectedStatus) => {
        const result = parseTodStatus(code);
        expect(result.appointmentType).toBe(expectedType);
        expect(result.status).toBe(expectedStatus);
      },
    );

    test.each([
      ['1', 'case-by-case', 'active'],
      ['3', 'standing', 'resigned'],
      ['5', 'standing', 'terminated'],
      ['6', 'standing', 'terminated'],
      ['7', 'standing', 'deceased'],
      ['8', 'case-by-case', 'active'],
      ['9', 'case-by-case', 'inactive'],
      ['10', 'case-by-case', 'inactive'],
      ['12', 'case-by-case', 'active'],
    ])(
      'should map numeric code "%s" to appointmentType=%s, status=%s',
      (code, expectedType, expectedStatus) => {
        const result = parseTodStatus(code);
        expect(result.appointmentType).toBe(expectedType);
        expect(result.status).toBe(expectedStatus);
      },
    );

    test('should handle whitespace around status codes', () => {
      expect(parseTodStatus(' PA ')).toEqual({ appointmentType: 'panel', status: 'active' });
      expect(parseTodStatus(' 1 ')).toEqual({ appointmentType: 'case-by-case', status: 'active' });
    });
  });

  describe('getDivisionOfficeName', () => {
    test('should map known division codes', () => {
      expect(getDivisionOfficeName('081')).toBe('Manhattan');
      expect(getDivisionOfficeName('071')).toBe('Brooklyn');
      expect(getDivisionOfficeName('391')).toBe('Dallas');
      expect(getDivisionOfficeName('751')).toBe('Honolulu');
    });

    test('should handle whitespace in division codes', () => {
      expect(getDivisionOfficeName(' 081 ')).toBe('Manhattan');
    });

    test('should return Unknown for invalid codes', () => {
      expect(getDivisionOfficeName('999999')).toBe('Unknown');
      expect(getDivisionOfficeName('')).toBe('Unknown');
    });
  });

  describe('getCourtId', () => {
    test('should map district codes to DXTR court IDs', () => {
      expect(getCourtId('01')).toBe('0101');
      expect(getCourtId('02')).toBe('0208');
      expect(getCourtId('76')).toBe('0090');
    });

    test('should handle whitespace in district codes', () => {
      expect(getCourtId(' 01 ')).toBe('0101');
      expect(getCourtId(' 02 ', ' 081 ')).toBe('0208');
    });

    test('should resolve multi-district states using division code', () => {
      // Georgia: Northern (32x), Middle (33x), Southern (34x)
      expect(getCourtId('19', '321')).toBe('113E');
      expect(getCourtId('19', '331')).toBe('113G');
      expect(getCourtId('19', '341')).toBe('113J');
      // Georgia without division falls back to default (Northern)
      expect(getCourtId('19')).toBe('113E');

      // West Virginia: Northern (24x), Southern (25x)
      expect(getCourtId('17', '241')).toBe('0424');
      expect(getCourtId('17', '250')).toBe('0425');

      // Louisiana: Eastern (30x), Middle (31x), Western (36x)
      expect(getCourtId('24', '302')).toBe('053L');
      expect(getCourtId('24', '313')).toBe('053N');
      expect(getCourtId('24', '361')).toBe('0536');

      // Mississippi: Northern (37x), Southern (38x)
      expect(getCourtId('25', '371')).toBe('0537');
      expect(getCourtId('25', '381')).toBe('0538');
    });

    test('should fallback to district mapping when division not found in DIVISION_TO_COURT_MAP', () => {
      // Provide a division code that is not in DIVISION_TO_COURT_MAP
      // but district code is valid
      expect(getCourtId('01', '999')).toBe('0101');
    });

    test('should use multi-district logic when division prefix matches but division not in map', () => {
      // Georgia (19) with division starting with '32' but not exact match in division map
      // Should use prefix '32' to resolve to Northern district
      expect(getCourtId('19', '329')).toBe('113E');
    });

    test('should throw error for invalid district codes', () => {
      expect(() => getCourtId('99')).toThrow('Unknown district code: 99');
      expect(() => getCourtId('')).toThrow('District code is required');
    });
  });

  describe('formatPhoneNumber', () => {
    test('should format 10-digit phone numbers', () => {
      expect(formatPhoneNumber('5551234567')).toBe('555-123-4567');
      expect(formatPhoneNumber('555-123-4567')).toBe('555-123-4567');
      expect(formatPhoneNumber('(555) 123-4567')).toBe('555-123-4567');
    });

    test('should handle 11-digit phone numbers with country code', () => {
      expect(formatPhoneNumber('15551234567')).toBe('555-123-4567');
      expect(formatPhoneNumber('1-555-123-4567')).toBe('555-123-4567');
    });

    test('should return original for invalid formats', () => {
      expect(formatPhoneNumber('123')).toBe('123');
      expect(formatPhoneNumber('not-a-phone')).toBe('not-a-phone');
    });

    test('should return undefined for undefined input', () => {
      expect(formatPhoneNumber(undefined)).toBeUndefined();
    });
  });

  describe('formatZipCode', () => {
    test('should format 5-digit ZIP codes', () => {
      expect(formatZipCode('12345')).toBe('12345');
      expect(formatZipCode('123-45')).toBe('12345');
    });

    test('should format 9-digit ZIP+4 codes', () => {
      expect(formatZipCode('123456789')).toBe('12345-6789');
      expect(formatZipCode('12345-6789')).toBe('12345-6789');
    });

    test('should format ZIP+4 with separate plus extension', () => {
      expect(formatZipCode('12345', '6789')).toBe('12345-6789');
    });

    test('should handle ZIP+4 with invalid plus extension length', () => {
      expect(formatZipCode('12345', '67')).toBe('12345');
      expect(formatZipCode('12345', '678')).toBe('12345');
      expect(formatZipCode('12345', '67890')).toBe('12345');
    });

    test('should return original for invalid formats', () => {
      expect(formatZipCode('123')).toBe('123');
      expect(formatZipCode('not-a-zip')).toBe('not-a-zip');
    });

    test('should return undefined for undefined input', () => {
      expect(formatZipCode(undefined)).toBeUndefined();
    });
  });

  describe('transformTrusteeRecord', () => {
    test('should transform complete trustee record', () => {
      const atsTrustee: AtsTrusteeRecord = {
        ID: 123,
        FIRST_NAME: 'John',
        LAST_NAME: 'Doe',
        MIDDLE: 'A',
        COMPANY: 'Trustee Corp',
        STREET: '123 Main St',
        STREET1: 'Suite 100',
        STREET_A2: undefined,
        CITY: 'New York',
        STATE: 'NY',
        ZIP: '10001',
        TELEPHONE: '5551234567',
        EMAIL_ADDRESS: 'john.doe@example.com',
      };

      const result = transformTrusteeRecord(atsTrustee);

      expect(result).toEqual({
        name: 'John A Doe',
        status: 'active',
        public: {
          address: {
            address1: '123 Main St',
            address2: 'Suite 100',
            city: 'New York',
            state: 'NY',
            zipCode: '10001',
            countryCode: 'US',
          },
          phone: { number: '555-123-4567' },
          email: 'john.doe@example.com',
          companyName: 'Trustee Corp',
        },
        legacy: {
          truIds: ['123'],
        },
      });
    });

    test('should handle minimal trustee record', () => {
      const atsTrustee: AtsTrusteeRecord = {
        ID: 456,
        FIRST_NAME: 'Jane',
        LAST_NAME: 'Smith',
      };

      const result = transformTrusteeRecord(atsTrustee);

      expect(result).toEqual({
        name: 'Jane Smith',
        status: 'active',
        public: {
          address: {
            address1: '',
            address2: undefined,
            city: '',
            state: '',
            zipCode: '',
            countryCode: 'US',
          },
        },
        legacy: {
          truIds: ['456'],
        },
      });
    });

    test('should set trustee status to provided appointment status', () => {
      const atsTrustee: AtsTrusteeRecord = {
        ID: 789,
        FIRST_NAME: 'Bob',
        LAST_NAME: 'Jones',
      };

      const result = transformTrusteeRecord(atsTrustee, 'resigned');

      expect(result.status).toBe('resigned');
    });

    test.each<{ appointmentStatus: AppointmentStatus }>([
      { appointmentStatus: 'active' },
      { appointmentStatus: 'inactive' },
      { appointmentStatus: 'voluntarily-suspended' },
      { appointmentStatus: 'resigned' },
      { appointmentStatus: 'terminated' },
      { appointmentStatus: 'deceased' },
    ])(
      'should pass through appointment status "$appointmentStatus" to trustee status',
      ({ appointmentStatus }) => {
        const atsTrustee: AtsTrusteeRecord = {
          ID: 789,
          FIRST_NAME: 'Bob',
          LAST_NAME: 'Jones',
        };

        const result = transformTrusteeRecord(atsTrustee, appointmentStatus);

        expect(result.status).toBe(appointmentStatus);
      },
    );

    test('should default trustee status to active when no status is provided', () => {
      const atsTrustee: AtsTrusteeRecord = {
        ID: 789,
        FIRST_NAME: 'Bob',
        LAST_NAME: 'Jones',
      };

      const result = transformTrusteeRecord(atsTrustee);

      expect(result.status).toBe('active');
    });

    test('should default trustee status to active when status is undefined', () => {
      const atsTrustee: AtsTrusteeRecord = {
        ID: 789,
        FIRST_NAME: 'Bob',
        LAST_NAME: 'Jones',
      };

      const result = transformTrusteeRecord(atsTrustee, undefined);

      expect(result.status).toBe('active');
    });

    test('should build name as "Unknown" when all name fields are empty', () => {
      const atsTrustee: AtsTrusteeRecord = {
        ID: 999,
      };

      const result = transformTrusteeRecord(atsTrustee);

      expect(result.name).toBe('Unknown');
    });

    test('should add internal contact when A2 address fields are present', () => {
      const atsTrustee: AtsTrusteeRecord = {
        ID: 123,
        FIRST_NAME: 'John',
        LAST_NAME: 'Doe',
        STREET: '123 Main St',
        CITY: 'New York',
        STATE: 'NY',
        ZIP: '10001',
        STREET_A2: '456 Internal St',
        CITY_A2: 'Albany',
        STATE_A2: 'NY',
        ZIP_A2: '12207',
        TELEPHONE: '5551234567',
        EMAIL_ADDRESS: 'john.doe@example.com',
      };

      const result = transformTrusteeRecord(atsTrustee);

      expect(result.internal).toBeDefined();
      expect(result.internal?.address.address1).toBe('456 Internal St');
      expect(result.internal?.address.city).toBe('Albany');
      expect(result.internal?.address.state).toBe('NY');
      expect(result.internal?.address.zipCode).toBe('12207');
      expect(result.internal?.phone?.number).toBe('555-123-4567');
      expect(result.internal?.email).toBe('john.doe@example.com');
    });

    test('should add internal contact with address2 field', () => {
      const atsTrustee: AtsTrusteeRecord = {
        ID: 123,
        FIRST_NAME: 'John',
        LAST_NAME: 'Doe',
        STREET_A2: '456 Internal St',
        STREET1_A2: 'Suite 200',
        CITY_A2: 'Albany',
        STATE_A2: 'NY',
        ZIP_A2: '12207',
      };

      const result = transformTrusteeRecord(atsTrustee);

      expect(result.internal).toBeDefined();
      expect(result.internal?.address.address2).toBe('Suite 200');
    });

    test('should add internal contact with ZIP+4', () => {
      const atsTrustee: AtsTrusteeRecord = {
        ID: 123,
        FIRST_NAME: 'John',
        LAST_NAME: 'Doe',
        STREET_A2: '456 Internal St',
        CITY_A2: 'Albany',
        STATE_A2: 'NY',
        ZIP_A2: '12207',
        ZIP_PLUS_A2: '1234',
      };

      const result = transformTrusteeRecord(atsTrustee);

      expect(result.internal).toBeDefined();
      expect(result.internal?.address.zipCode).toBe('12207-1234');
    });

    test('should not add internal contact when no A2 fields are present', () => {
      const atsTrustee: AtsTrusteeRecord = {
        ID: 123,
        FIRST_NAME: 'John',
        LAST_NAME: 'Doe',
        STREET: '123 Main St',
        CITY: 'New York',
        STATE: 'NY',
        ZIP: '10001',
      };

      const result = transformTrusteeRecord(atsTrustee);

      expect(result.internal).toBeUndefined();
    });
  });

  describe('transformAppointmentRecord', () => {
    test('should transform standard appointment', () => {
      const atsAppointment: AtsAppointmentRecord = {
        TRU_ID: 123,
        DISTRICT: '02',
        DIVISION: '081',
        CHAPTER: '7',
        DATE_APPOINTED: new Date('2023-01-15'),
        STATUS: 'PA',
        EFFECTIVE_DATE: new Date('2023-01-15'),
      };

      const result = transformAppointmentRecord(atsAppointment);

      expect(result).toEqual({
        chapter: '7',
        appointmentType: 'panel',
        courtId: '0208',
        divisionCode: '081',
        appointedDate: '2023-01-15',
        status: 'active',
        effectiveDate: '2023-01-15',
      });
    });

    test('should handle case-by-case chapter appointments', () => {
      const atsAppointment: AtsAppointmentRecord = {
        TRU_ID: 123,
        DISTRICT: '02',
        DIVISION: '081',
        CHAPTER: '12CBC',
        DATE_APPOINTED: new Date('2023-03-01'),
        STATUS: 'C',
        EFFECTIVE_DATE: new Date('2023-03-01'),
      };

      const result = transformAppointmentRecord(atsAppointment);

      expect(result).toEqual({
        chapter: '12',
        appointmentType: 'case-by-case',
        courtId: '0208',
        divisionCode: '081',
        appointedDate: '2023-03-01',
        status: 'active',
        effectiveDate: '2023-03-01',
      });
    });

    test('should throw if DATE_APPOINTED is missing', () => {
      const atsAppointment: AtsAppointmentRecord = {
        TRU_ID: 123,
        DISTRICT: '02',
        DIVISION: '081',
        CHAPTER: '7',
        STATUS: 'PA',
      };

      expect(() => transformAppointmentRecord(atsAppointment)).toThrow(
        'DATE_APPOINTED is required',
      );
    });

    test('should throw error for invalid district', () => {
      const atsAppointment: AtsAppointmentRecord = {
        TRU_ID: 123,
        DISTRICT: '99',
        DIVISION: '999',
        CHAPTER: '7',
        STATUS: 'PA',
      };

      expect(() => transformAppointmentRecord(atsAppointment)).toThrow('Unknown district code: 99');
    });

    test('should resolve Chapter 11 + V status to 11-subchapter-v / pool / active', () => {
      const atsAppointment: AtsAppointmentRecord = {
        TRU_ID: 123,
        DISTRICT: '02',
        DIVISION: '081',
        CHAPTER: '11',
        DATE_APPOINTED: new Date('2023-06-01'),
        STATUS: 'V',
        EFFECTIVE_DATE: new Date('2023-06-01'),
      };

      const result = transformAppointmentRecord(atsAppointment);

      expect(result.chapter).toBe('11-subchapter-v');
      expect(result.appointmentType).toBe('pool');
      expect(result.status).toBe('active');
    });

    test('should resolve Chapter 11 + VR status to 11-subchapter-v / out-of-pool / resigned', () => {
      const atsAppointment: AtsAppointmentRecord = {
        TRU_ID: 123,
        DISTRICT: '02',
        DIVISION: '081',
        CHAPTER: '11',
        DATE_APPOINTED: new Date('2023-06-01'),
        STATUS: 'VR',
        EFFECTIVE_DATE: new Date('2023-06-01'),
      };

      const result = transformAppointmentRecord(atsAppointment);

      expect(result.chapter).toBe('11-subchapter-v');
      expect(result.appointmentType).toBe('out-of-pool');
      expect(result.status).toBe('resigned');
    });

    test.each([
      { todChapter: '12CBC', todStatus: '1', expectedStatus: 'active' },
      { todChapter: '12CBC', todStatus: '2', expectedStatus: 'active' },
      { todChapter: '12CBC', todStatus: '3', expectedStatus: 'inactive' },
      { todChapter: '12CBC', todStatus: '5', expectedStatus: 'inactive' },
      { todChapter: '12CBC', todStatus: '7', expectedStatus: 'inactive' },
      { todChapter: '13CBC', todStatus: '1', expectedStatus: 'active' },
      { todChapter: '13CBC', todStatus: '3', expectedStatus: 'inactive' },
    ])(
      'should override CBC chapter $todChapter + status $todStatus to case-by-case / $expectedStatus',
      ({ todChapter, todStatus, expectedStatus }) => {
        const atsAppointment: AtsAppointmentRecord = {
          TRU_ID: 123,
          DISTRICT: '02',
          DIVISION: '081',
          CHAPTER: todChapter,
          DATE_APPOINTED: new Date('2023-06-01'),
          STATUS: todStatus,
          EFFECTIVE_DATE: new Date('2023-06-01'),
        };

        const result = transformAppointmentRecord(atsAppointment);

        const expectedChapter = todChapter.replace('CBC', '');
        expect(result.chapter).toBe(expectedChapter);
        expect(result.appointmentType).toBe('case-by-case');
        expect(result.status).toBe(expectedStatus);
      },
    );

    test.each([
      { todChapter: '12', expectedType: 'standing', expectedStatus: 'active' },
      { todChapter: '13', expectedType: 'standing', expectedStatus: 'active' },
    ])(
      'should override code 1 with Chapter $todChapter to $expectedType / $expectedStatus',
      ({ todChapter, expectedType, expectedStatus }) => {
        const atsAppointment: AtsAppointmentRecord = {
          TRU_ID: 123,
          DISTRICT: '02',
          DIVISION: '081',
          CHAPTER: todChapter,
          DATE_APPOINTED: new Date('2023-06-01'),
          STATUS: '1',
          EFFECTIVE_DATE: new Date('2023-06-01'),
        };

        const result = transformAppointmentRecord(atsAppointment);

        expect(result.appointmentType).toBe(expectedType);
        expect(result.status).toBe(expectedStatus);
      },
    );

    test('should use flat map default for code 1 with Chapter 11 (no override)', () => {
      const atsAppointment: AtsAppointmentRecord = {
        TRU_ID: 123,
        DISTRICT: '02',
        DIVISION: '081',
        CHAPTER: '11',
        DATE_APPOINTED: new Date('2023-06-01'),
        STATUS: '1',
        EFFECTIVE_DATE: new Date('2023-06-01'),
      };

      const result = transformAppointmentRecord(atsAppointment);

      expect(result.appointmentType).toBe('case-by-case');
      expect(result.status).toBe('active');
    });

    test('should use appointedDate as effectiveDate when effectiveDate is missing', () => {
      const atsAppointment: AtsAppointmentRecord = {
        TRU_ID: 123,
        DISTRICT: '02',
        DIVISION: '081',
        CHAPTER: '7',
        DATE_APPOINTED: new Date('2023-01-15'),
        STATUS: 'PA',
      };

      const result = transformAppointmentRecord(atsAppointment);

      expect(result.appointedDate).toBe('2023-01-15');
      expect(result.effectiveDate).toBe('2023-01-15');
    });

    test('should handle whitespace in chapter and status codes', () => {
      const atsAppointment: AtsAppointmentRecord = {
        TRU_ID: 123,
        DISTRICT: '02',
        DIVISION: '081',
        CHAPTER: ' 7 ',
        DATE_APPOINTED: new Date('2023-01-15'),
        STATUS: ' PA ',
        EFFECTIVE_DATE: new Date('2023-01-15'),
      };

      const result = transformAppointmentRecord(atsAppointment);

      expect(result.chapter).toBe('7');
      expect(result.appointmentType).toBe('panel');
      expect(result.status).toBe('active');
    });

    test('should throw error for invalid chapter codes', () => {
      const atsAppointment: AtsAppointmentRecord = {
        TRU_ID: 123,
        DISTRICT: '02',
        DIVISION: '081',
        CHAPTER: '9',
        DATE_APPOINTED: new Date('2023-01-15'),
        STATUS: 'PA',
      };

      // Chapter 9 is not a valid chapter code
      expect(() => transformAppointmentRecord(atsAppointment)).toThrow('Unknown chapter code: 9');
    });

    test('should handle empty status code (defaults to panel/active)', () => {
      const atsAppointment: AtsAppointmentRecord = {
        TRU_ID: 123,
        DISTRICT: '02',
        DIVISION: '081',
        CHAPTER: '7',
        DATE_APPOINTED: new Date('2023-01-15'),
        STATUS: '',
        EFFECTIVE_DATE: new Date('2023-01-15'),
      };

      const result = transformAppointmentRecord(atsAppointment);

      expect(result.appointmentType).toBe('panel');
      expect(result.status).toBe('active');
    });

    test('should handle missing status code (defaults to panel/active)', () => {
      const atsAppointment: AtsAppointmentRecord = {
        TRU_ID: 123,
        DISTRICT: '02',
        DIVISION: '081',
        CHAPTER: '7',
        DATE_APPOINTED: new Date('2023-01-15'),
        EFFECTIVE_DATE: new Date('2023-01-15'),
      };

      const result = transformAppointmentRecord(atsAppointment);

      expect(result.appointmentType).toBe('panel');
      expect(result.status).toBe('active');
    });
  });

  // Note: isValidAppointmentForChapter tests removed - function is now imported from common
  // and is already tested in common/src/cams/trustee-appointments.test.ts

  describe('applyAppointmentOverrides', () => {
    test('should apply CBC chapter override for 12CBC status 1', () => {
      const chapterMapping = { chapter: '12' };
      const result = applyAppointmentOverrides(chapterMapping, '12CBC', '1', {
        appointmentType: 'standing',
        status: 'active',
      });

      expect(result.chapter).toBe('12');
      expect(result.appointmentType).toBe('case-by-case');
      expect(result.status).toBe('active');
    });

    test('should apply CBC chapter override for 13CBC status 3', () => {
      const chapterMapping = { chapter: '13' };
      const result = applyAppointmentOverrides(chapterMapping, '13CBC', '3', {
        appointmentType: 'standing',
        status: 'active',
      });

      expect(result.chapter).toBe('13');
      expect(result.appointmentType).toBe('case-by-case');
      expect(result.status).toBe('inactive');
    });

    test('should convert Chapter 11 + V to 11-subchapter-v', () => {
      const chapterMapping = { chapter: '11' };
      const result = applyAppointmentOverrides(chapterMapping, '11', 'V', {
        appointmentType: 'pool',
        status: 'active',
      });

      expect(result.chapter).toBe('11-subchapter-v');
      expect(result.appointmentType).toBe('pool');
      expect(result.status).toBe('active');
    });

    test('should convert Chapter 11 + VR to 11-subchapter-v', () => {
      const chapterMapping = { chapter: '11' };
      const result = applyAppointmentOverrides(chapterMapping, '11', 'VR', {
        appointmentType: 'out-of-pool',
        status: 'resigned',
      });

      expect(result.chapter).toBe('11-subchapter-v');
      expect(result.appointmentType).toBe('out-of-pool');
      expect(result.status).toBe('resigned');
    });

    test('should apply code 1 standing override for Chapter 12', () => {
      const chapterMapping = { chapter: '12' };
      const result = applyAppointmentOverrides(chapterMapping, '12', '1', {
        appointmentType: 'case-by-case',
        status: 'active',
      });

      expect(result.chapter).toBe('12');
      expect(result.appointmentType).toBe('standing');
      expect(result.status).toBe('active');
    });

    test('should apply code 1 standing override for Chapter 13', () => {
      const chapterMapping = { chapter: '13' };
      const result = applyAppointmentOverrides(chapterMapping, '13', '1', {
        appointmentType: 'case-by-case',
        status: 'active',
      });

      expect(result.chapter).toBe('13');
      expect(result.appointmentType).toBe('standing');
      expect(result.status).toBe('active');
    });

    test('should not apply code 1 override for Chapter 7', () => {
      const chapterMapping = { chapter: '7' };
      const result = applyAppointmentOverrides(chapterMapping, '7', '1', {
        appointmentType: 'case-by-case',
        status: 'active',
      });

      expect(result.chapter).toBe('7');
      expect(result.appointmentType).toBe('case-by-case');
      expect(result.status).toBe('active');
    });

    test('should use appointmentType from chapter mapping (legacy CBC)', () => {
      const chapterMapping = { chapter: '12', appointmentType: 'case-by-case' as const };
      const result = applyAppointmentOverrides(chapterMapping, '12', 'C', {
        appointmentType: 'panel',
        status: 'active',
      });

      expect(result.chapter).toBe('12');
      expect(result.appointmentType).toBe('case-by-case');
      expect(result.status).toBe('active');
    });

    test('should use status mapping when no overrides apply', () => {
      const chapterMapping = { chapter: '7' };
      const result = applyAppointmentOverrides(chapterMapping, '7', 'PA', {
        appointmentType: 'panel',
        status: 'active',
      });

      expect(result.chapter).toBe('7');
      expect(result.appointmentType).toBe('panel');
      expect(result.status).toBe('active');
    });

    test('should prioritize CBC override over code 1 standing', () => {
      const chapterMapping = { chapter: '12' };
      const result = applyAppointmentOverrides(chapterMapping, '12CBC', '1', {
        appointmentType: 'standing',
        status: 'active',
      });

      // CBC override should win
      expect(result.chapter).toBe('12');
      expect(result.appointmentType).toBe('case-by-case');
      expect(result.status).toBe('active');
    });

    test('should prioritize CBC override over chapter mapping appointmentType', () => {
      const chapterMapping = { chapter: '12' };
      const result = applyAppointmentOverrides(chapterMapping, '12CBC', '3', {
        appointmentType: 'panel',
        status: 'active',
      });

      // CBC override should win
      expect(result.chapter).toBe('12');
      expect(result.appointmentType).toBe('case-by-case');
      expect(result.status).toBe('inactive');
    });
  });

  describe('getAppointmentKey', () => {
    test('should create unique key for appointment', () => {
      const appointment = {
        chapter: '7' as const,
        appointmentType: 'panel' as const,
        courtId: '0208',
        divisionCode: '081',
        appointedDate: '2023-01-15',
        status: 'active' as const,
        effectiveDate: '2023-01-15',
      };

      const key = getAppointmentKey('123', appointment);

      expect(key).toBe('123-0208-081-7-panel');
    });
  });
});
