import { formatAppointmentDate, buildDistrictDisplay } from './appointmentDisplay';

describe('appointmentDisplay', () => {
  describe('formatAppointmentDate', () => {
    test('formats a normal date as mm/dd/yyyy', () => {
      expect(formatAppointmentDate('2025-12-01T00:00:00.000Z')).toBe('12/01/2025');
    });

    test('displays "Not Specified" for Unix epoch sentinel dates', () => {
      expect(formatAppointmentDate('1970-01-01T00:00:00.000Z')).toBe('Not Specified');
    });
  });

  describe('buildDistrictDisplay', () => {
    test('uses courtName when available', () => {
      expect(buildDistrictDisplay({ courtName: 'Southern District of New York' })).toBe(
        'Southern District of New York',
      );
    });

    test('falls back to courtId when courtName is missing', () => {
      expect(buildDistrictDisplay({ courtId: '0208' })).toBe('Court 0208');
    });

    test('falls back to a default message when neither is available', () => {
      expect(buildDistrictDisplay({})).toBe('Court information not available');
    });
  });
});
