import { CourtDivisionDetails } from '@common/cams/courts';
import { describe } from 'vitest';

import { courtSorter, getDivisionComboOptions } from './dataVerificationHelper';

describe('data verification helper tests', () => {
  test('should properly map court information for selection', () => {
    const offices: CourtDivisionDetails[] = [
      {
        courtDivisionCode: '111',
        courtDivisionName: 'Manhattan',
        courtId: '',
        courtName: 'Test Court 1',
        groupDesignator: '',
        officeCode: '',
        officeName: '',
        regionId: '',
        regionName: '',
        state: 'NY',
      },
      {
        courtDivisionCode: '222',
        courtDivisionName: 'Los Angeles',
        courtId: '',
        courtName: 'Test Court 2',
        groupDesignator: '',
        officeCode: '',
        officeName: '',
        regionId: '',
        regionName: '',
        state: 'CA',
      },
    ];
    const expected = [
      {
        label: 'Test Court 1 (Manhattan)',
        selectedLabel: 'Manhattan, NY',
        value: '111',
      },
      {
        label: 'Test Court 2 (Los Angeles)',
        selectedLabel: 'Los Angeles, CA',
        value: '222',
      },
    ];
    const actual = getDivisionComboOptions(offices);
    expect(actual).toEqual(expected);
  });

  test('should get office select options', () => {
    const testOffices: CourtDivisionDetails[] = [
      {
        courtDivisionCode: '001',
        courtDivisionName: 'New York 1',
        courtId: '0101',
        courtName: 'A',
        groupDesignator: 'AA',
        officeCode: '1',
        officeName: 'A1',
        regionId: '02',
        regionName: 'NEW YORK',
        state: 'NY',
      },
      {
        courtDivisionCode: '003',
        courtDivisionName: 'New York 1',
        courtId: '0103',
        courtName: 'C',
        groupDesignator: 'AC',
        officeCode: '3',
        officeName: 'C1',
        regionId: '02',
        regionName: 'NEW YORK',
        state: 'NY',
      },
      {
        courtDivisionCode: '002',
        courtDivisionName: 'New York 1',
        courtId: '0102',
        courtName: 'B',
        groupDesignator: 'AB',
        officeCode: '2',
        officeName: 'B1',
        regionId: '02',
        regionName: 'NEW YORK',
        state: 'NY',
      },
    ];

    const expectedOptions: Array<Record<string, string>> = [
      { label: 'A (New York 1)', selectedLabel: 'New York 1, NY', value: '001' },
      { label: 'B (New York 1)', selectedLabel: 'New York 1, NY', value: '002' },
      { label: 'C (New York 1)', selectedLabel: 'New York 1, NY', value: '003' },
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
        courtDivisionName: 'New York 1',
        courtId: '0102',
        courtName: 'B',
        groupDesignator: 'AB',
        isLegacy: true,
        officeCode: '2',
        officeName: 'B1',
        regionId: '02',
        regionName: 'NEW YORK',
        state: 'NY',
      },
    ];

    const expectedOptions: Array<Record<string, string>> = [
      { label: 'B (New York 1) Legacy', selectedLabel: 'New York 1, NY', value: '002' },
    ];

    const actualOptions = getDivisionComboOptions(testOffices);
    expect(actualOptions).toStrictEqual(expectedOptions);
  });

  test('should sort offices', () => {
    const testOffices: CourtDivisionDetails[] = [
      {
        courtDivisionCode: '001',
        courtDivisionName: 'New York 1',
        courtId: '0101',
        courtName: 'A',
        groupDesignator: 'AA',
        officeCode: '1',
        officeName: 'A1',
        regionId: '02',
        regionName: 'NEW YORK',
        state: 'NY',
      },
      {
        courtDivisionCode: '003',
        courtDivisionName: 'New York 1',
        courtId: '0103',
        courtName: 'C',
        groupDesignator: 'AC',
        officeCode: '3',
        officeName: 'C1',
        regionId: '02',
        regionName: 'NEW YORK',
        state: 'NY',
      },
      {
        courtDivisionCode: '003',
        courtDivisionName: 'New York 1',
        courtId: '0103',
        courtName: 'C',
        groupDesignator: 'AC',
        officeCode: '3',
        officeName: 'C1',
        regionId: '02',
        regionName: 'NEW YORK',
        state: 'NY',
      },
      {
        courtDivisionCode: '002',
        courtDivisionName: 'New York 1',
        courtId: '0102',
        courtName: 'B',
        groupDesignator: 'AB',
        officeCode: '2',
        officeName: 'B1',
        regionId: '02',
        regionName: 'NEW YORK',
        state: 'NY',
      },
      {
        courtDivisionCode: '008',
        courtDivisionName: 'California 1',
        courtId: '0102',
        courtName: 'B',
        groupDesignator: 'AE',
        officeCode: '2',
        officeName: 'B1',
        regionId: '02',
        regionName: 'NEW YORK',
        state: 'CA',
      },
    ];
    const expectedOffices: CourtDivisionDetails[] = [
      {
        courtDivisionCode: '008',
        courtDivisionName: 'California 1',
        courtId: '0102',
        courtName: 'B',
        groupDesignator: 'AE',
        officeCode: '2',
        officeName: 'B1',
        regionId: '02',
        regionName: 'NEW YORK',
        state: 'CA',
      },
      {
        courtDivisionCode: '001',
        courtDivisionName: 'New York 1',
        courtId: '0101',
        courtName: 'A',
        groupDesignator: 'AA',
        officeCode: '1',
        officeName: 'A1',
        regionId: '02',
        regionName: 'NEW YORK',
        state: 'NY',
      },
      {
        courtDivisionCode: '002',
        courtDivisionName: 'New York 1',
        courtId: '0102',
        courtName: 'B',
        groupDesignator: 'AB',
        officeCode: '2',
        officeName: 'B1',
        regionId: '02',
        regionName: 'NEW YORK',
        state: 'NY',
      },
      {
        courtDivisionCode: '003',
        courtDivisionName: 'New York 1',
        courtId: '0103',
        courtName: 'C',
        groupDesignator: 'AC',
        officeCode: '3',
        officeName: 'C1',
        regionId: '02',
        regionName: 'NEW YORK',
        state: 'NY',
      },
      {
        courtDivisionCode: '003',
        courtDivisionName: 'New York 1',
        courtId: '0103',
        courtName: 'C',
        groupDesignator: 'AC',
        officeCode: '3',
        officeName: 'C1',
        regionId: '02',
        regionName: 'NEW YORK',
        state: 'NY',
      },
    ];
    const actualOffices = testOffices.sort(courtSorter);
    expect(actualOffices).toEqual<CourtDivisionDetails[]>(expectedOffices);
  });
});
