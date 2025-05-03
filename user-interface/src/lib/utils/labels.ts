import { ConsolidationType, OrderType } from '@common/cams/orders';

export const orderStatusType = new Map([
  ['approved', 'Verified'],
  ['pending', 'Pending Review'],
  ['rejected', 'Rejected'],
]);

export const orderType = new Map<OrderType, string>([
  ['consolidation', 'Consolidation'],
  ['transfer', 'Transfer'],
]);

export const consolidationTypeMap = new Map<ConsolidationType, string>([
  ['administrative', 'Joint Administration'],
  ['substantive', 'Substantive Consolidation'],
]);
