import {
  getAppointmentDetails,
  formatChapterType,
  formatAppointmentType,
  computeTrusteeName,
  formatTrusteeListName,
  sortTypedPhoneNumbers,
  sortTrusteePhoneNumbers,
  AppointmentChapterType,
  AppointmentType,
  TypedPhoneNumber,
} from './trustees';
import MockData from './test-utilities/mock-data';

describe('trustees', () => {
  describe('formatChapterType', () => {
    test.each([
      ['7', '7'],
      ['11', '11'],
      ['11-subchapter-v', '11 Subchapter V'],
      ['12', '12'],
      ['13', '13'],
    ])('should format "%s" as "%s"', (input, expected) => {
      expect(formatChapterType(input as AppointmentChapterType)).toBe(expected);
    });
  });

  describe('formatAppointmentType', () => {
    test.each([
      ['panel', 'Panel'],
      ['off-panel', 'Off Panel'],
      ['case-by-case', 'Case by Case'],
      ['pool', 'Pool'],
      ['out-of-pool', 'Out of Pool'],
      ['standing', 'Standing'],
      ['elected', 'Elected'],
      ['converted-case', 'Converted Case'],
    ])('should format "%s" as "%s"', (input, expected) => {
      expect(formatAppointmentType(input as AppointmentType)).toBe(expected);
    });
  });

  describe('computeTrusteeName', () => {
    test('should return "First Middle Last" when all three parts provided', () => {
      expect(computeTrusteeName('Jane', 'Ann', 'Doe')).toBe('Jane Ann Doe');
    });

    test('should return "First Last" when middleName is undefined', () => {
      expect(computeTrusteeName('Jane', undefined, 'Doe')).toBe('Jane Doe');
    });

    test('should return "First Last" when middleName is empty string', () => {
      expect(computeTrusteeName('Jane', '', 'Doe')).toBe('Jane Doe');
    });

    test('should trim whitespace from each part', () => {
      expect(computeTrusteeName('  Jane  ', '  Ann  ', '  Doe  ')).toBe('Jane Ann Doe');
    });

    test('should handle empty firstName and lastName', () => {
      expect(computeTrusteeName('', undefined, '')).toBe('');
    });
  });

  describe('formatTrusteeListName', () => {
    test('should return "Last, First Middle" when all three parts provided', () => {
      expect(formatTrusteeListName('John', 'Q', 'Doe')).toBe('Doe, John Q');
    });

    test('should return "Last, First" when middleName is undefined', () => {
      expect(formatTrusteeListName('John', undefined, 'Doe')).toBe('Doe, John');
    });

    test('should return fallback name when firstName and lastName are missing', () => {
      expect(formatTrusteeListName(undefined, undefined, undefined, 'John Doe')).toBe('John Doe');
    });

    test('should return empty string when all parts and fallback are empty strings', () => {
      expect(formatTrusteeListName('', '', '', '')).toBe('');
    });

    test('should return empty string when all parts are undefined and no fallback', () => {
      expect(formatTrusteeListName(undefined, undefined, undefined)).toBe('');
    });

    test('should trim whitespace from each part', () => {
      expect(formatTrusteeListName('  John  ', '  Q  ', '  Doe  ')).toBe('Doe, John Q');
    });

    test('should trim whitespace from fallback name', () => {
      expect(formatTrusteeListName(undefined, undefined, undefined, '  John Doe  ')).toBe(
        'John Doe',
      );
    });

    test('should return "Last" when only lastName is provided', () => {
      expect(formatTrusteeListName(undefined, undefined, 'Doe')).toBe('Doe');
    });

    test('should return "First" when only firstName is provided', () => {
      expect(formatTrusteeListName('Jane', undefined, undefined)).toBe('Jane');
    });

    test('should return "First Middle" when lastName is missing', () => {
      expect(formatTrusteeListName('Jane', 'Q', undefined)).toBe('Jane Q');
    });

    test('should ignore middleName when firstName is missing but lastName exists', () => {
      expect(formatTrusteeListName(undefined, 'Q', 'Doe')).toBe('Doe, Q');
    });
  });

  describe('getAppointmentDetails', () => {
    test.each([
      ['7', 'panel', '7 - Panel'],
      ['7', 'off-panel', '7 - Off Panel'],
      ['7', 'elected', '7 - Elected'],
      ['7', 'converted-case', '7 - Converted Case'],
      ['11', 'case-by-case', '11 - Case by Case'],
      ['11-subchapter-v', 'pool', '11 Subchapter V - Pool'],
      ['11-subchapter-v', 'out-of-pool', '11 Subchapter V - Out of Pool'],
      ['12', 'standing', '12 - Standing'],
      ['12', 'case-by-case', '12 - Case by Case'],
      ['13', 'standing', '13 - Standing'],
      ['13', 'case-by-case', '13 - Case by Case'],
    ])(
      'should format chapter "%s" with type "%s" as "%s"',
      (chapter, appointmentType, expected) => {
        expect(
          getAppointmentDetails(
            chapter as AppointmentChapterType,
            appointmentType as AppointmentType,
          ),
        ).toBe(expected);
      },
    );
  });

  describe('sortTypedPhoneNumbers', () => {
    test('sorts by phone type in canonical order, regardless of input order', () => {
      const phones: TypedPhoneNumber[] = [
        { type: 'workMobile', number: '555-666-0000' },
        { type: 'direct', number: '555-111-0000' },
        { type: 'home', number: '555-333-0000' },
        { type: 'fax', number: '555-222-0000' },
        { type: 'personalMobile', number: '555-555-0000' },
        { type: 'office', number: '555-444-0000' },
      ];

      expect(sortTypedPhoneNumbers(phones).map((p) => p.type)).toEqual([
        'direct',
        'fax',
        'home',
        'office',
        'personalMobile',
        'workMobile',
      ]);
    });

    test('sorts by phone number when types match', () => {
      const phones: TypedPhoneNumber[] = [
        { type: 'direct', number: '555-222-0000' },
        { type: 'direct', number: '555-111-0000' },
      ];

      expect(sortTypedPhoneNumbers(phones).map((p) => p.number)).toEqual([
        '555-111-0000',
        '555-222-0000',
      ]);
    });

    test('sorts by extension when type and number match', () => {
      const phones: TypedPhoneNumber[] = [
        { type: 'direct', number: '555-111-0000', extension: '22' },
        { type: 'direct', number: '555-111-0000', extension: '11' },
        { type: 'direct', number: '555-111-0000' },
      ];

      expect(sortTypedPhoneNumbers(phones).map((p) => p.extension)).toEqual([
        undefined,
        '11',
        '22',
      ]);
    });

    test('does not mutate the input array', () => {
      const phones: TypedPhoneNumber[] = [
        { type: 'home', number: '555-333-0000' },
        { type: 'direct', number: '555-111-0000' },
      ];
      const original = [...phones];

      sortTypedPhoneNumbers(phones);

      expect(phones).toEqual(original);
    });
  });

  describe('sortTrusteePhoneNumbers', () => {
    test('sorts the internal contact phones', () => {
      const trustee = MockData.getTrustee({
        internal: {
          phones: [
            { type: 'home', number: '555-333-0000' },
            { type: 'direct', number: '555-111-0000' },
          ],
        },
      });

      const result = sortTrusteePhoneNumbers(trustee);

      expect(result.internal?.phones?.map((p) => p.type)).toEqual(['direct', 'home']);
    });

    test('sorts phones independently for every staff member', () => {
      const trustee = MockData.getTrustee({
        staff: [
          MockData.getTrusteeStaff({
            id: 'staff-1',
            contact: {
              phones: [
                { type: 'workMobile', number: '555-666-0000' },
                { type: 'direct', number: '555-111-0000' },
              ],
            },
          }),
          MockData.getTrusteeStaff({
            id: 'staff-2',
            contact: {
              phones: [
                { type: 'office', number: '555-444-0000' },
                { type: 'fax', number: '555-222-0000' },
              ],
            },
          }),
        ],
      });

      const result = sortTrusteePhoneNumbers(trustee);

      expect(result.staff?.[0].contact?.phones?.map((p) => p.type)).toEqual([
        'direct',
        'workMobile',
      ]);
      expect(result.staff?.[1].contact?.phones?.map((p) => p.type)).toEqual(['fax', 'office']);
    });

    test('leaves contacts without phones untouched', () => {
      const trustee = MockData.getTrustee({ internal: { email: 'a@example.com' } });

      const result = sortTrusteePhoneNumbers(trustee);

      expect(result.internal).toEqual(trustee.internal);
    });

    test('leaves staff members without phones untouched', () => {
      const trustee = MockData.getTrustee({
        staff: [MockData.getTrusteeStaff({ id: 'staff-1', contact: { email: 'a@example.com' } })],
      });

      const result = sortTrusteePhoneNumbers(trustee);

      expect(result.staff?.[0].contact).toEqual(trustee.staff?.[0].contact);
    });
  });
});
