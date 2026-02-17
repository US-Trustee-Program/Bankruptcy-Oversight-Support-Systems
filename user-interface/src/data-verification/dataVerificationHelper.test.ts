import { describe } from 'vitest';
import { CourtDivisionDetails } from '@common/cams/courts';
import { getDivisionComboOptions } from './dataVerificationHelper';

describe('data verification helper tests', () => {
  test('should properly map court information for selection', () => {
    const offices: CourtDivisionDetails[] = [
      {
        officeName: '',
        officeCode: '',
        courtId: '',
        courtName: 'Test Court 1',
        courtDivisionCode: '111',
        courtDivisionName: 'Manhattan',
        groupDesignator: '',
        regionId: '',
        regionName: '',
        state: 'NY',
      },
      {
        officeName: '',
        officeCode: '',
        courtId: '',
        courtName: 'Test Court 2',
        courtDivisionCode: '222',
        courtDivisionName: 'Los Angeles',
        groupDesignator: '',
        regionId: '',
        regionName: '',
        state: 'CA',
      },
    ];
    const expected = [
      {
        value: '111',
        label: 'Test Court 1 (Manhattan)',
        selectedLabel: 'Manhattan, NY',
      },
      {
        value: '222',
        label: 'Test Court 2 (Los Angeles)',
        selectedLabel: 'Los Angeles, CA',
      },
    ];
    const actual = getDivisionComboOptions(offices);
    expect(actual).toEqual(expected);
  });

  test('should get office select options', () => {
    const testOffices: CourtDivisionDetails[] = [
      {
        courtDivisionCode: '001',
        groupDesignator: 'AA',
        courtId: '0101',
        officeCode: '1',
        officeName: 'A1',
        state: 'NY',
        courtName: 'A',
        courtDivisionName: 'New York 1',
        regionId: '02',
        regionName: 'NEW YORK',
      },
      {
        courtDivisionCode: '003',
        groupDesignator: 'AC',
        courtId: '0103',
        officeCode: '3',
        officeName: 'C1',
        state: 'NY',
        courtName: 'C',
        courtDivisionName: 'New York 1',
        regionId: '02',
        regionName: 'NEW YORK',
      },
      {
        courtDivisionCode: '002',
        groupDesignator: 'AB',
        courtId: '0102',
        officeCode: '2',
        officeName: 'B1',
        state: 'NY',
        courtName: 'B',
        courtDivisionName: 'New York 1',
        regionId: '02',
        regionName: 'NEW YORK',
      },
    ];

    const expectedOptions: Array<Record<string, string>> = [
      { value: '001', label: 'A (New York 1)', selectedLabel: 'New York 1, NY' },
      { value: '002', label: 'B (New York 1)', selectedLabel: 'New York 1, NY' },
      { value: '003', label: 'C (New York 1)', selectedLabel: 'New York 1, NY' },
    ];

    const sortedTestOffices = [...testOffices].sort((a, b) =>
      a.courtDivisionCode < b.courtDivisionCode ? -1 : 1,
    );

    const actualOptions = getDivisionComboOptions(sortedTestOffices);
    expect(actualOptions).toStrictEqual(expectedOptions);
  });

  test('should label legacy offices in the options', () => {
    const testOffices: CourtDivisionDetails[] = [
      {
        courtDivisionCode: '002',
        groupDesignator: 'AB',
        courtId: '0102',
        officeCode: '2',
        officeName: 'B1',
        state: 'NY',
        courtName: 'B',
        courtDivisionName: 'New York 1',
        regionId: '02',
        regionName: 'NEW YORK',
      },
    ];

    const expectedOptions: Array<Record<string, string>> = [
      { value: '002', label: 'B (New York 1)', selectedLabel: 'New York 1, NY' },
    ];

    const actualOptions = getDivisionComboOptions(testOffices);
    expect(actualOptions).toStrictEqual(expectedOptions);
  });
});
