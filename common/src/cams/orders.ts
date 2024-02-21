import { CaseDocketEntry, CaseSummary } from './cases';

export type OrderStatus = 'pending' | 'approved' | 'rejected';
export type OrderType = 'transfer' | 'consolidation';

export type ConsolidationOrderActionRejection = ConsolidationOrder & {
  rejectedCases: Array<string>;
  leadCase: undefined;
};

export type ConsolidationOrderActionApproval = ConsolidationOrder & {
  approvedCases: Array<string>;
  leadCase: ConsolidationOrderCase;
};

export type TransferOrder = CaseSummary & {
  id: string;
  orderType: 'transfer';
  orderDate: string;
  status: OrderStatus;
  docketEntries: CaseDocketEntry[];
  newCaseId?: string;
  newCase?: CaseSummary;
  reason?: string;
};

export type ConsolidationOrder = {
  id?: string;
  consolidationId: string;
  orderType: 'consolidation';
  orderDate: string;
  status: OrderStatus;
  courtName: string;
  docketEntries: CaseDocketEntry[];
  divisionCode: string;
  jobId: number;
  leadCaseIdHint?: string;
  leadCase?: ConsolidationOrderCase;
  childCases: Array<ConsolidationOrderCase>;
  reason?: string;
};

export type ConsolidationOrderCase = CaseSummary & {
  docketEntries: CaseDocketEntry[];
};

export type RawConsolidationOrder = ConsolidationOrderCase & {
  orderDate: string;
  jobId: number;
  leadCaseIdHint?: string;
};

export type Order = TransferOrder | ConsolidationOrder;

export interface ConsolidationHistory {
  status: OrderStatus;
  leadCase?: CaseSummary;
  childCases: Array<CaseSummary>;
  // For History
  // rejected?
  //   status, reason?
  // approved?
  //   am I lead?
  //     yes - status, all childCases
  //     no - status, leadCase
  // pending?
  //   status
}

export function isTransferOrder(order: Order): order is TransferOrder {
  return order.orderType === 'transfer';
}

export function isConsolidationHistory(history: unknown): history is ConsolidationHistory {
  return typeof history === 'object' && 'childCases' in history && 'status' in history;
}

export function isConsolidationOrder(order: Order): order is ConsolidationOrder {
  return order.orderType === 'consolidation';
}

type TransferOrderActionRejection = {
  id: string;
  caseId: string;
  status: 'rejected';
  reason?: string;
};

type TransferOrderActionApproval = {
  id: string;
  caseId: string;
  newCase?: Partial<CaseSummary>; // TODO CAMS-326 may want to make this required
  status: 'approved';
};

export type TransferOrderAction = TransferOrderActionRejection | TransferOrderActionApproval;

type OrderActionRejection<T = TransferOrder | ConsolidationOrder> = {
  id: string;
  status: 'rejected';
  reason?: string;
  order: T;
};

type OrderActionApproval<T = TransferOrder | ConsolidationOrder> = {
  id: string;
  status: 'approved';
  order: T;
};

export type OrderAction<T> = OrderActionRejection<T> | OrderActionApproval<T>;

export type OrderSync = {
  consolidations: ConsolidationOrder[];
  transfers: TransferOrder[];
  maxTxId: string;
};

export type RawOrderSync = {
  consolidations: RawConsolidationOrder[];
  transfers: TransferOrder[];
  maxTxId: string;
};
