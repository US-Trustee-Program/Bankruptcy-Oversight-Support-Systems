import { CaseDocketEntry, CaseSummary } from './cases';

export type OrderStatus = 'pending' | 'approved' | 'rejected';
export type OrderType = 'transfer' | 'consolidation';
export type ConsolidationType = 'administrative' | 'substantive';

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
  docketSuggestedCaseNumber?: string;
  newCase?: CaseSummary;
  reason?: string;
};

export type ConsolidationOrder = {
  id?: string;
  deleted?: true;
  consolidationId: string;
  consolidationType: ConsolidationType;
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

export function isTransferOrder(order: Order): order is TransferOrder {
  return order.orderType === 'transfer';
}

export function isConsolidationOrder(order: Order): order is ConsolidationOrder {
  return order.orderType === 'consolidation';
}

type TransferOrderActionRejection = {
  id: string;
  caseId: string;
  orderType: 'transfer';
  status: 'rejected';
  reason?: string;
};

type TransferOrderActionApproval = {
  id: string;
  caseId: string;
  orderType: 'transfer';
  newCase: Partial<CaseSummary>;
  status: 'approved';
};

export type TransferOrderAction = TransferOrderActionRejection | TransferOrderActionApproval;

type OrderActionRejection<T = TransferOrder> = {
  id: string;
  status: 'rejected';
  reason?: string;
  order: T;
};

type OrderActionApproval<T = TransferOrder> = {
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
