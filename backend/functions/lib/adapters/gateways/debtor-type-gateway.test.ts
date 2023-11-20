import { getDebtorTypeLabel } from './debtor-type-gateway';

describe('Debtor Type Name gateway', () => {
  test('should return the name of a known debtor type by ID', () => {
    const debtorTypeName = getDebtorTypeLabel('CB');
    expect(debtorTypeName).toEqual('Corporate Business');
  });
  test('should return an unknown label for an invalid ID', () => {
    const debtorTypeName = getDebtorTypeLabel('ZZ');
    expect(debtorTypeName).toEqual('Debtor type information is not available.');
  });
});
