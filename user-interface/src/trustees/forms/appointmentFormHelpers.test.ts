import { CourtDivisionDetails } from '@common/cams/courts';
import { resolveConflictDistrictLabel } from './appointmentFormHelpers';

describe('resolveConflictDistrictLabel', () => {
  const chattanooga: CourtDivisionDetails = {
    officeName: 'Chattanooga',
    officeCode: '1',
    courtId: '0649',
    courtName: 'Eastern District of Tennessee',
    courtDivisionCode: '491',
    courtDivisionName: 'Chattanooga',
    groupDesignator: 'CN',
    regionId: '08',
    regionName: 'ATLANTA',
  };

  test('resolves the division by tempCourtDivisionCode so Winchester does not read as Chattanooga (CAMS-936 Phase 1)', () => {
    const winchester: CourtDivisionDetails = {
      ...chattanooga,
      officeName: 'Winchester',
      officeCode: '4',
      tempCourtDivisionCode: '494',
      courtDivisionName: 'Winchester',
    };
    const allCourts = [chattanooga, winchester];

    const label = resolveConflictDistrictLabel('0649', '494', allCourts);

    expect(label).toBe('Eastern District of Tennessee (Winchester)');
  });

  test('resolves the division by ustDivisionCode when tempCourtDivisionCode is absent (pre-existing, not yet migrated)', () => {
    const winchester: CourtDivisionDetails = {
      ...chattanooga,
      officeName: 'Winchester',
      officeCode: '4',
      ustDivisionCode: '494',
      courtDivisionName: 'Winchester',
    };
    const allCourts = [chattanooga, winchester];

    const label = resolveConflictDistrictLabel('0649', '494', allCourts);

    expect(label).toBe('Eastern District of Tennessee (Winchester)');
  });

  test('returns an empty string when no division matches the conflicting code', () => {
    const label = resolveConflictDistrictLabel('0649', '494', [chattanooga]);

    expect(label).toBe('');
  });

  test('returns an empty string when no court matches the courtId', () => {
    const label = resolveConflictDistrictLabel('9999', '491', [chattanooga]);

    expect(label).toBe('');
  });
});
