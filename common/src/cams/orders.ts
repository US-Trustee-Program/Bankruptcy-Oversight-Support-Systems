import { CaseDocketEntry, CaseSummary } from './cases';

export type OrderStatus = 'pending' | 'approved' | 'rejected';
export type OrderType = 'transfer' | 'consolidation';

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
  caseId: string;
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
