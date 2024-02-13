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

export type ConsolidationOrder = CaseSummary & {
  id?: string;
  orderType: 'consolidation';
  orderDate: string;
  status: OrderStatus;
  docketEntries: CaseDocketEntry[];
  cases: Array<CaseSummary>;
};

export type Order = TransferOrder | ConsolidationOrder;

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
  orders: TransferOrder[];
  maxTxId: string;
};
