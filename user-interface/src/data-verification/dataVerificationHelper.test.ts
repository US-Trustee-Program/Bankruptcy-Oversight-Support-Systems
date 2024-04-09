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
        value: '',
        label: ' ',
      },
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
});
