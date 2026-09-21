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

    test('renders "Court undefined" when both courtName and courtId are missing', () => {
      expect(buildDistrictDisplay({})).toBe('Court undefined');
    });
  });

  describe('buildAppointmentHeading', () => {
    test('includes the division name when present', () => {
      expect(
        buildAppointmentHeading({
          courtName: 'Southern District of New York',
          courtDivisionName: 'Manhattan',
          chapter: '7',
          appointmentType: 'panel',
        }),
      ).toBe('Southern District of New York (Manhattan): Chapter 7 - Panel');
    });

    test('omits the division suffix when courtDivisionName is missing', () => {
      expect(
        buildAppointmentHeading({
          courtName: 'District of Alaska',
          chapter: '13',
          appointmentType: 'standing',
        }),
      ).toBe('District of Alaska: Chapter 13 - Standing');
    });

    test('falls back to courtId when courtName is missing', () => {
      expect(
        buildAppointmentHeading({
          courtId: '0208',
          chapter: '11-subchapter-v',
          appointmentType: 'pool',
        }),
      ).toBe('Court 0208: Chapter 11 Subchapter V - Pool');
    });

    test('falls back to "Court undefined" when neither courtName nor courtId is present', () => {
      // Documents buildDistrictDisplay's existing fallback for legacy/malformed
      // ATS-migration data missing both fields -- see appointmentDisplay.ts's
      // comment on buildDistrictDisplay.
      expect(
        buildAppointmentHeading({
          chapter: '7',
          appointmentType: 'panel',
        }),
      ).toBe('Court undefined: Chapter 7 - Panel');
    });
  });
});
