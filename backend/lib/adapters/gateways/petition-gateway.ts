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
  petitionCode: string;
  petitionLabel: string;
  isVoluntary: boolean;
  isTransfer: boolean;
}

export function getPetitionInfo(petitionCode: string | null): PetitionInfo {
  return {
    petitionCode: petitionCode ?? '',
    petitionLabel: petitionLabelMap.has(petitionCode)
      ? petitionLabelMap.get(petitionCode)
      : 'Petition Not Available',
    isVoluntary: voluntaryCodes.includes(petitionCode),
    isTransfer: transferCodes.includes(petitionCode),
  };
}
