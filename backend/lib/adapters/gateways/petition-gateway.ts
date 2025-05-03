const petitionLabelMap = new Map<string, string>([
  ['IP', 'Involuntary'],
  ['TI', 'Involuntary'],
  ['TV', 'Voluntary'],
  ['VP', 'Voluntary'],
]);

const voluntaryCodes = ['VP', 'TV'];
const transferCodes = ['TV', 'TI'];

// TODO: Maybe this should go somewhere more appropriate with the case model or such.
export interface PetitionInfo {
  isTransfer: boolean;
  isVoluntary: boolean;
  petitionCode: string;
  petitionLabel: string;
}

export function getPetitionInfo(petitionCode: null | string): PetitionInfo {
  return {
    isTransfer: transferCodes.includes(petitionCode),
    isVoluntary: voluntaryCodes.includes(petitionCode),
    petitionCode: petitionCode ?? '',
    petitionLabel: petitionLabelMap.has(petitionCode)
      ? petitionLabelMap.get(petitionCode)
      : 'Petition Not Available',
  };
}
