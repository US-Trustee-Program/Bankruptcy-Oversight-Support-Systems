import { getPetitionInfo, PetitionInfo } from './petition-gateway';

describe('Petition Type Label gateway', () => {
  // TODO: consider using test.each
  test('should return the name of a known petition type by ID', () => {
    const petitionCode = 'VP';
    const debtorTypeName = getPetitionInfo(petitionCode);
    const expected: PetitionInfo = {
      isTransfer: false,
      isVoluntary: true,
      petitionCode,
      petitionLabel: 'Voluntary',
    };
    expect(debtorTypeName).toEqual(expected);
  });

  test('should return an unknown label for an invalid ID', () => {
    const petitionCode = 'ZZ';
    const debtorTypeName = getPetitionInfo(petitionCode);
    const expected: PetitionInfo = {
      isTransfer: false,
      isVoluntary: false,
      petitionCode,
      petitionLabel: '',
    };
    expect(debtorTypeName).toEqual(expected);
  });
});
