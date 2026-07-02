import { ConsolidationOrder, Order, TransferOrder } from './orders';
import {
  TrusteeMatchVerification,
  TrusteeMatchVerificationListItem,
} from './trustee-match-verification';

type DataVerificationItem = Order | TrusteeMatchVerificationListItem;
export type DataVerificationItemType = DataVerificationItem['taskType'];

// Backfill dataflows pass the full TrusteeMatchVerification (which has Auditable fields);
// UI type guards and display code pass TrusteeMatchVerificationListItem.
type AnyTrusteeVerification = TrusteeMatchVerification | TrusteeMatchVerificationListItem;
type DataVerificationItemOrFull = Order | AnyTrusteeVerification;

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

export function computeTaskDate(item: DataVerificationItemOrFull): string {
  if (item.taskType === 'trustee-match') {
    const v = item as Partial<TrusteeMatchVerification>;
    return v.createdOn ?? v.updatedOn ?? String(item.taskDate);
  }
  return (item as Order).orderDate;
}
