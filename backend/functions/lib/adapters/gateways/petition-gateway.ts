const petitionLabelMap = new Map<string, string>([
  ['IP', 'Involuntary'],
  ['TI', 'Involuntary'],
  ['TV', 'Voluntary'],
  ['VP', 'Voluntary'],
]);

export function getPetitionLabel(id: string | undefined): string {
  if (petitionLabelMap.has(id)) return petitionLabelMap.get(id);
  return ''; // Unknown case.
}
