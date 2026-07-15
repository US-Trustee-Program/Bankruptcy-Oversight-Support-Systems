import { ConsolidationOrder, Order, TransferOrder } from './orders';
import {
  TrusteeMatchVerification,
  TrusteeMatchVerificationListItem,
} from './trustee-match-verification';

export type DataVerificationItem = Order | TrusteeMatchVerificationListItem;
export type DataVerificationItemType = DataVerificationItem['taskType'];

export function isTransferOrder(item: DataVerificationItem): item is TransferOrder {
  return item.taskType === 'transfer';
}

export function isConsolidationOrder(item: DataVerificationItem): item is ConsolidationOrder {
  return item.taskType === 'consolidation';
}

export function isTrusteeMatchVerification(
  item: DataVerificationItem,
): item is TrusteeMatchVerificationListItem {
  return item.taskType === 'trustee-match';
}

// TODO: The backfill path (TrusteeMatchVerification branch) duck-types via 'createdOn' in item
// because TrusteeMatchVerification is structurally incompatible with TrusteeMatchVerificationListItem.
// Give the backfill path its own narrower helper instead of overloading this function.
// See: https://github.com/US-Trustee-Program/Bankruptcy-Oversight-Support-Systems/pull/2618#discussion_r3531853958
export function computeTaskDate(item: DataVerificationItem | TrusteeMatchVerification): string {
  if (item.taskType === 'trustee-match') {
    const createdOn = 'createdOn' in item ? item.createdOn : undefined;
    const updatedOn = 'updatedOn' in item ? item.updatedOn : undefined;
    const date = createdOn ?? updatedOn ?? item.taskDate;
    return date instanceof Date ? date.toISOString() : (date ?? '');
  }
  return (item as Order).orderDate;
}
