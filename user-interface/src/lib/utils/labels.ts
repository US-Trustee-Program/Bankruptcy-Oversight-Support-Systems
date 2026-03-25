import { ConsolidationType } from '@common/cams/orders';
import { DataVerificationItemType } from '@common/cams/data-verification';

export const orderStatusType = new Map([
  ['pending', 'Pending Review'],
  ['approved', 'Verified'],
  ['rejected', 'Rejected'],
]);

export const orderType = new Map<DataVerificationItemType, string>([
  ['transfer', 'Transfer'],
  ['consolidation', 'Consolidation'],
  ['trustee-match', 'Trustee Mismatch'],
]);

export const consolidationTypeMap = new Map<ConsolidationType, string>([
  ['administrative', 'Joint Administration'],
  ['substantive', 'Substantive Consolidation'],
]);
