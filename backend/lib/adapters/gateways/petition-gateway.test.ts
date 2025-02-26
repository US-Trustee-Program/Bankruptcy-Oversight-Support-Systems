import { getPetitionInfo, PetitionInfo } from './petition-gateway';

describe('Petition Type Label gateway', () => {
  // TODO: consider using test.each for more petition types
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

  test('should return an not available label for an invalid ID', () => {
    ['ZZ', null].forEach((petitionCode) => {
      const expected: PetitionInfo = {
        isTransfer: false,
        isVoluntary: false,
        petitionCode: petitionCode ?? '',
        petitionLabel: 'Petition Not Available',
      };
      expect(getPetitionInfo(petitionCode)).toEqual(expected);
    });
  });
});
