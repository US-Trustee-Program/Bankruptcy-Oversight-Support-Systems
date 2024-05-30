import { describe } from 'vitest';
import { OfficeDetails } from '@common/cams/courts';
import { getOfficeList } from './dataVerificationHelper';

describe('data verification helper tests', () => {
  test('should properly map court information for selection', () => {
    const offices: OfficeDetails[] = [
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
      },
    ];
    const expected = [
      {
        value: '111',
        label: 'Test Court 1 (Manhattan)',
      },
      {
        value: '222',
        label: 'Test Court 2 (Los Angeles)',
      },
    ];
    const actual = getOfficeList(offices);
    expect(actual).toEqual(expected);
  });

  test('should get office select options', () => {
    const testOffices: OfficeDetails[] = [
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
      { value: '001', label: 'A (New York 1)' },
      { value: '002', label: 'B (New York 1)' },
      { value: '003', label: 'C (New York 1)' },
    ];

    const sortedTestOffices = [...testOffices].sort((a, b) =>
      a.courtDivisionCode < b.courtDivisionCode ? -1 : 1,
    );

    const actualOptions = getOfficeList(sortedTestOffices);
    expect(actualOptions).toStrictEqual(expectedOptions);
  });
});
