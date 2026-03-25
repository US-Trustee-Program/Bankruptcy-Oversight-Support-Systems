import { ConsolidationOrder, Order, TransferOrder } from './orders';
import { TrusteeMatchVerification } from './trustee-match-verification';

export type DataVerificationItem = Order | TrusteeMatchVerification;
export type DataVerificationItemType = DataVerificationItem['orderType'];

export function isTransferOrder(item: DataVerificationItem): item is TransferOrder {
  return item.orderType === 'transfer';
}

export function isConsolidationOrder(item: DataVerificationItem): item is ConsolidationOrder {
  return item.orderType === 'consolidation';
}

export function isTrusteeMatchVerification(
  item: DataVerificationItem,
): item is TrusteeMatchVerification {
  return item.orderType === 'trustee-match';
}
