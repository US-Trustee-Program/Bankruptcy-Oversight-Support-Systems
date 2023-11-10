import { CamsError } from '../../common-errors/cams-error';
import { getDebtorTypeLabel } from './debtor-type-gateway';

describe('Debtor Type Name gateway', () => {
  test('should return the name of a known debtor type by ID', () => {
    const debtorTypeName = getDebtorTypeLabel('CB');
    expect(debtorTypeName).toEqual('Corporate Business');
  });
  test('should throw an error for an invalid ID', () => {
    const expectedException = new CamsError('DEBTOR-TYPE-NAME-GATEWAY', {
      message: 'Cannot find debtor type name by ID',
      data: { id: 'ZZ' },
    });
    expect(() => {
      getDebtorTypeLabel('ZZ');
    }).toThrow(expectedException);
  });
});
