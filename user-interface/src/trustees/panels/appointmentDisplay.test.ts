import {
  isActiveAppointment,
  formatAppointmentDate,
  buildDistrictDisplay,
  buildAppointmentHeading,
} from './appointmentDisplay';
import { AppointmentStatus } from '@common/cams/trustees';

describe('appointmentDisplay', () => {
  describe('isActiveAppointment', () => {
    test('returns true for active status', () => {
      expect(isActiveAppointment('active')).toBe(true);
    });

    test.each<AppointmentStatus>([
      'inactive',
      'voluntarily-suspended',
      'involuntarily-suspended',
      'deceased',
      'resigned',
      'terminated',
      'removed',
    ])('returns false for %s status', (status) => {
      expect(isActiveAppointment(status)).toBe(false);
    });
  });

  describe('formatAppointmentDate', () => {
    test('formats a normal date as mm/dd/yyyy', () => {
      expect(formatAppointmentDate('2025-12-01T00:00:00.000Z')).toBe('12/01/2025');
    });

    test('displays "Not Specified" for Unix epoch sentinel dates', () => {
      expect(formatAppointmentDate('1970-01-01T00:00:00.000Z')).toBe('Not Specified');
    });
  });

  describe('buildDistrictDisplay', () => {
    test('uses courtName over courtId when both are available', () => {
      expect(
        buildDistrictDisplay({ courtName: 'Southern District of New York', courtId: '0208' }),
      ).toBe('Southern District of New York');
    });

    test('falls back to courtId when courtName is missing', () => {
      expect(buildDistrictDisplay({ courtId: '0208' })).toBe('Court 0208');
    });
  });

  describe('buildAppointmentHeading', () => {
    test('includes the division display when courtDivisionName is present', () => {
      expect(
        buildAppointmentHeading(
          { courtName: 'Southern District of New York', courtDivisionName: 'Manhattan' },
          '11 Subchapter V',
        ),
      ).toBe('Southern District of New York (Manhattan): Chapter 11 Subchapter V');
    });

    test('omits the division parenthetical when courtDivisionName is absent', () => {
      expect(
        buildAppointmentHeading({ courtName: 'Southern District of New York' }, '7 Panel'),
      ).toBe('Southern District of New York: Chapter 7 Panel');
    });

    test('falls back to courtId via buildDistrictDisplay when courtName is missing', () => {
      expect(buildAppointmentHeading({ courtId: '0208' }, '7 Panel')).toBe(
        'Court 0208: Chapter 7 Panel',
      );
    });
  });
});
