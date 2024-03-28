import { ConsolidationType, OrderType } from '@common/cams/orders';

export const orderStatusType = new Map([
  ['pending', 'Pending Review'],
  ['approved', 'Approved'],
  ['rejected', 'Rejected'],
]);

export const orderType = new Map<OrderType, string>([
  ['transfer', 'Transfer'],
  ['consolidation', 'Consolidation'],
]);

export const consolidationType = new Map<ConsolidationType, string>([
  ['administrative', 'Joint Administration'],
  ['substantive', 'Substantive Consolidation'],
]);
