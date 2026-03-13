import { ConsolidationType, OrderType } from '@common/cams/orders';

export const orderStatusType = new Map([
  ['pending', 'Pending Review'],
  ['approved', 'Verified'],
  ['rejected', 'Rejected'],
]);

export const orderType = new Map<OrderType, string>([
  ['transfer', 'Transfer'],
  ['consolidation', 'Consolidation'],
  ['trustee-match', 'Trustee Match Verification'],
]);

export const consolidationTypeMap = new Map<ConsolidationType, string>([
  ['administrative', 'Joint Administration'],
  ['substantive', 'Substantive Consolidation'],
]);
