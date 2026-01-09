import {
  TRUSTEE_STATUS_VALUES,
  getAppointmentDetails,
  formatChapterType,
  formatAppointmentType,
  ChapterType,
  AppointmentType,
} from './trustees';

describe('trustees', () => {
  test('TRUSTEE_STATUS_VALUES', () => {
    expect(TRUSTEE_STATUS_VALUES).toEqual(['active', 'not active', 'suspended']);
  });

  describe('formatChapterType', () => {
    test.each([
      ['7', '7'],
      ['11', '11'],
      ['11-subchapter-v', '11 - Subchapter V'],
      ['12', '12'],
      ['13', '13'],
    ])('should format "%s" as "%s"', (input: ChapterType, expected: string) => {
      expect(formatChapterType(input)).toBe(expected);
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
    ])('should format "%s" as "%s"', (input: AppointmentType, expected: string) => {
      expect(formatAppointmentType(input)).toBe(expected);
    });
  });

  describe('getAppointmentDetails', () => {
    test.each([
      ['7', 'panel', '7 - Panel'],
      ['7', 'off-panel', '7 - Off Panel'],
      ['11', 'case-by-case', '11 - Case by Case'],
      ['11-subchapter-v', 'pool', '11 - Subchapter V - Pool'],
      ['11-subchapter-v', 'out-of-pool', '11 - Subchapter V - Out of Pool'],
      ['12', 'standing', '12 - Standing'],
      ['12', 'case-by-case', '12 - Case by Case'],
      ['13', 'standing', '13 - Standing'],
      ['13', 'case-by-case', '13 - Case by Case'],
    ])(
      'should format chapter "%s" with type "%s" as "%s"',
      (chapter: ChapterType, appointmentType: AppointmentType, expected: string) => {
        expect(getAppointmentDetails(chapter, appointmentType)).toBe(expected);
      },
    );
  });
});
