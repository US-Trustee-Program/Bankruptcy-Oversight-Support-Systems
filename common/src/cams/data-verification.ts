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

// Accepts both the list item (UI/sort paths) and the full document (backfill path).
// TrusteeMatchVerification is not structurally assignable to TrusteeMatchVerificationListItem
// because the list item carries preselectedCandidate/candidateCount that the full type lacks,
// so the union is explicit here.
export function computeTaskDate(item: DataVerificationItem | TrusteeMatchVerification): string {
  if (item.taskType === 'trustee-match') {
    const createdOn = 'createdOn' in item ? item.createdOn : undefined;
    const updatedOn = 'updatedOn' in item ? item.updatedOn : undefined;
    return createdOn ?? updatedOn ?? String(item.taskDate);
  }
  return (item as Order).orderDate;
}
