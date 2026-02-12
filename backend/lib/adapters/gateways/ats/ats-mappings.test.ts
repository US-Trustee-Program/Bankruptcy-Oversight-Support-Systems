import { describe, expect, test, vi } from 'vitest';
import {
  parseChapterAndType,
  parseTodStatus,
  getDivisionOfficeName,
  getCourtId,
  formatPhoneNumber,
  formatZipCode,
  transformTrusteeRecord,
  transformAppointmentRecord,
  isValidAppointmentForChapter,
  getAppointmentKey,
} from './ats-mappings';
import { AtsTrusteeRecord, AtsAppointmentRecord } from '../../types/ats.types';

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

    test('should throw error for invalid chapters', () => {
      expect(() => parseChapterAndType('99')).toThrow('Unknown chapter code: 99');
      expect(() => parseChapterAndType('')).toThrow('Chapter code is required');
    });
  });

  describe('parseTodStatus', () => {
    test('should parse single letter codes', () => {
      expect(parseTodStatus('P')).toEqual({ appointmentType: 'panel', status: 'active' });
      expect(parseTodStatus('O')).toEqual({ appointmentType: 'off-panel', status: 'active' });
      expect(parseTodStatus('C')).toEqual({ appointmentType: 'case-by-case', status: 'active' });
      expect(parseTodStatus('S')).toEqual({ appointmentType: 'standing', status: 'active' });
    });

    test('should parse two-letter codes', () => {
      expect(parseTodStatus('PA')).toEqual({ appointmentType: 'panel', status: 'active' });
      expect(parseTodStatus('PI')).toEqual({ appointmentType: 'panel', status: 'inactive' });
      expect(parseTodStatus('PS')).toEqual({
        appointmentType: 'panel',
        status: 'voluntarily-suspended',
      });
      expect(parseTodStatus('OD')).toEqual({ appointmentType: 'off-panel', status: 'deceased' });
    });

    test('should parse numeric codes', () => {
      expect(parseTodStatus('1')).toEqual({ appointmentType: 'panel', status: 'active' });
      expect(parseTodStatus('5')).toEqual({ appointmentType: 'off-panel', status: 'active' });
      expect(parseTodStatus('9')).toEqual({ appointmentType: 'case-by-case', status: 'active' });
      expect(parseTodStatus('11')).toEqual({ appointmentType: 'standing', status: 'active' });
    });

    test('should handle case insensitive input', () => {
      expect(parseTodStatus('pa')).toEqual({ appointmentType: 'panel', status: 'active' });
      expect(parseTodStatus('od')).toEqual({ appointmentType: 'off-panel', status: 'deceased' });
    });

    test('should return defaults for unknown status', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      expect(parseTodStatus('ZZ')).toEqual({ appointmentType: 'panel', status: 'active' });
      expect(parseTodStatus('')).toEqual({ appointmentType: 'panel', status: 'active' });

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('getDivisionOfficeName', () => {
    test('should map known division codes', () => {
      expect(getDivisionOfficeName('081')).toBe('Manhattan');
      expect(getDivisionOfficeName('071')).toBe('Brooklyn');
      expect(getDivisionOfficeName('391')).toBe('Dallas');
      expect(getDivisionOfficeName('751')).toBe('Honolulu');
    });

    test('should return Unknown for invalid codes', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      expect(getDivisionOfficeName('999999')).toBe('Unknown');
      expect(getDivisionOfficeName('')).toBe('Unknown');

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('getCourtId', () => {
    test('should map district codes to court IDs', () => {
      expect(getCourtId('01')).toBe('usbc-ma');
      expect(getCourtId('02')).toBe('usbc-sdny');
      expect(getCourtId('19')).toBe('usbc-ga');
      expect(getCourtId('76')).toBe('usbc-dc');
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
        public: {
          address: {
            address1: '123 Main St',
            address2: 'Suite 100',
            address3: undefined,
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
          truId: '123',
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
        public: {
          address: {
            address1: '',
            address2: undefined,
            address3: undefined,
            city: '',
            state: '',
            zipCode: '',
            countryCode: 'US',
          },
        },
        legacy: {
          truId: '456',
        },
      });
    });
  });

  describe('transformAppointmentRecord', () => {
    test('should transform standard appointment', () => {
      const atsAppointment: AtsAppointmentRecord = {
        ID: 123,
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
        courtId: 'usbc-sdny',
        divisionCode: '081',
        appointedDate: '2023-01-15',
        status: 'active',
        effectiveDate: '2023-01-15',
      });
    });

    test('should handle case-by-case chapter appointments', () => {
      const atsAppointment: AtsAppointmentRecord = {
        ID: 123,
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
        courtId: 'usbc-sdny',
        divisionCode: '081',
        appointedDate: '2023-03-01',
        status: 'active',
        effectiveDate: '2023-03-01',
      });
    });

    test('should use current date if dates are missing', () => {
      const atsAppointment: AtsAppointmentRecord = {
        ID: 123,
        DISTRICT: '02',
        DIVISION: '081',
        CHAPTER: '7',
        STATUS: 'PA',
      };

      const result = transformAppointmentRecord(atsAppointment);
      const today = new Date().toISOString().split('T')[0];

      expect(result.appointedDate).toBe(today);
      expect(result.effectiveDate).toBe(today);
    });

    test('should throw error for invalid district', () => {
      const atsAppointment: AtsAppointmentRecord = {
        ID: 123,
        DISTRICT: '99',
        DIVISION: '081',
        CHAPTER: '7',
        STATUS: 'PA',
      };

      expect(() => transformAppointmentRecord(atsAppointment)).toThrow('Unknown district code: 99');
    });
  });

  describe('isValidAppointmentForChapter', () => {
    test('should validate chapter 7 appointments', () => {
      expect(isValidAppointmentForChapter('7', 'panel')).toBe(true);
      expect(isValidAppointmentForChapter('7', 'off-panel')).toBe(true);
      expect(isValidAppointmentForChapter('7', 'elected')).toBe(true);
      expect(isValidAppointmentForChapter('7', 'converted-case')).toBe(true);
      expect(isValidAppointmentForChapter('7', 'standing')).toBe(false);
      expect(isValidAppointmentForChapter('7', 'case-by-case')).toBe(false);
    });

    test('should validate chapter 11 appointments', () => {
      expect(isValidAppointmentForChapter('11', 'case-by-case')).toBe(true);
      expect(isValidAppointmentForChapter('11', 'panel')).toBe(false);
      expect(isValidAppointmentForChapter('11', 'standing')).toBe(false);
    });

    test('should validate chapter 12 appointments', () => {
      expect(isValidAppointmentForChapter('12', 'standing')).toBe(true);
      expect(isValidAppointmentForChapter('12', 'case-by-case')).toBe(true);
      expect(isValidAppointmentForChapter('12', 'panel')).toBe(false);
    });

    test('should validate chapter 13 appointments', () => {
      expect(isValidAppointmentForChapter('13', 'standing')).toBe(true);
      expect(isValidAppointmentForChapter('13', 'case-by-case')).toBe(true);
      expect(isValidAppointmentForChapter('13', 'panel')).toBe(false);
    });
  });

  describe('getAppointmentKey', () => {
    test('should create unique key for appointment', () => {
      const appointment = {
        chapter: '7' as const,
        appointmentType: 'panel' as const,
        courtId: 'usbc-sdny',
        divisionCode: '081',
        appointedDate: '2023-01-15',
        status: 'active' as const,
        effectiveDate: '2023-01-15',
      };

      const key = getAppointmentKey('123', appointment);

      expect(key).toBe('123-usbc-sdny-081-7-panel');
    });
  });
});
