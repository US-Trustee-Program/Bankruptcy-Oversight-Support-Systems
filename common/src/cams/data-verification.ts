import { Order } from './orders';
import { TrusteeMatchVerification } from './trustee-match-verification';

export type DataVerificationItem = Order | TrusteeMatchVerification;

export function isTrusteeMatchVerification(item: {
  orderType: string;
}): item is TrusteeMatchVerification {
  return item.orderType === 'trustee-match';
}
