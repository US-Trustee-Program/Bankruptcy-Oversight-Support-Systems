const debtorTypeLabelMap = new Map<string, string>([
  ['CB', 'Corporate Business'],
  ['FD', 'Foreign Debtor'],
  ['IB', 'Individual Business'],
  ['IC', 'Individual Consumer'],
  ['JC', 'Joint Consumer'],
  ['MU', 'Municipality'],
  ['PB', 'Partnership Business'],
]);

export function getDebtorTypeLabel(id: null | string): string {
  return debtorTypeLabelMap.has(id) ? debtorTypeLabelMap.get(id) : 'Debtor Type Not Available';
}
