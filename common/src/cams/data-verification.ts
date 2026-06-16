import { ConsolidationOrder, Order, TransferOrder } from './orders';
import { TrusteeMatchVerification } from './trustee-match-verification';

type DataVerificationItem = Order | TrusteeMatchVerification;
export type DataVerificationItemType = DataVerificationItem['taskType'];

export function isTransferOrder(item: DataVerificationItem): item is TransferOrder {
  return item.taskType === 'transfer';
}

export function isConsolidationOrder(item: DataVerificationItem): item is ConsolidationOrder {
  return item.taskType === 'consolidation';
}

export function isTrusteeMatchVerification(
  item: DataVerificationItem,
): item is TrusteeMatchVerification {
  return item.taskType === 'trustee-match';
}

export function computeTaskDate(item: DataVerificationItem): string {
  if (isTrusteeMatchVerification(item)) {
    return item.createdOn ?? item.updatedOn;
  }
  return item.orderDate;
}
