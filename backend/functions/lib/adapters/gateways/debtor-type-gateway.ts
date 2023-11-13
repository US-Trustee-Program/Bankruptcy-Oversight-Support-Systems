import { CamsError } from '../../common-errors/cams-error';

// TODO: This lookup may need to be migrated to a database at some point in the future.
// This is a domain concern that we have not decided on where is the most appropriate place to keep outside of the gateway directory.

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
