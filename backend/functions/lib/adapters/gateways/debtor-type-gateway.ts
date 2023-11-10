import { CamsError } from '../../common-errors/cams-error';

const MODULE_NAME = 'DEBTOR-TYPE-NAME-GATEWAY';

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
  throw new CamsError(MODULE_NAME, {
    message: 'Cannot find debtor type name by ID',
    data: { id },
  });
}
