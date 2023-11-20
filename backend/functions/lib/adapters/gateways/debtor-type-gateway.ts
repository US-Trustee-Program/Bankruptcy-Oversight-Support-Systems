const debtorTypeLabelMap = new Map<string, string>([
  ['CB', 'Corporate Business'],
  ['FD', 'Foreign Debtor'],
  ['IB', 'Individual Business'],
  ['IC', 'Individual Consumer'],
  ['JC', 'Joint Consumer'],
  ['MU', 'Municipality'],
  ['PB', 'Partnership Business'],
]);

export function getDebtorTypeLabel(id: string | undefined): string {
  if (debtorTypeLabelMap.has(id)) return debtorTypeLabelMap.get(id);
  return 'Debtor type information is not available.';
}
