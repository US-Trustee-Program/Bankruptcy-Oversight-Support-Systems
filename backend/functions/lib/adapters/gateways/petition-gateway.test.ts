import { getPetitionInfo } from './petition-gateway';

describe('Petition Type Label gateway', () => {
  test('should return the name of a known petition type by ID', () => {
    const debtorTypeName = getPetitionInfo('VP');
    expect(debtorTypeName).toEqual('Voluntary');
  });

  test('should return an unknown label for an invalid ID', () => {
    const debtorTypeName = getPetitionInfo('ZZ');
    expect(debtorTypeName).toEqual('');
  });
});
