import { CaseDetailInterface, CaseDocketEntry, CaseSummary } from './cases';

export type OrderStatus = 'pending' | 'approved' | 'rejected';
export type OrderType = 'transfer' | 'consolidation';

export type TransferOrder = CaseDetailInterface & {
  id?: string;
  orderType: 'transfer';
  orderDate: string;
  status: OrderStatus;
  docketEntries: CaseDocketEntry[];
  newCaseId?: string;
  newCase?: Partial<CaseSummary>;
  reason?: string;
};

export type Order = TransferOrder;

type TransferOrderActionRejection = {
  id: string;
  caseId: string;
  status: 'rejected';
  reason?: string;
};

type TransferOrderActionApproval = {
  id: string;
  caseId: string;
  newCase?: Partial<CaseSummary>; // TODO CASM-326 may want to make this required
  status: 'approved';
};

export type TransferOrderAction = TransferOrderActionRejection | TransferOrderActionApproval;

export type OrderSync = {
  orders: TransferOrder[];
  maxTxId: string;
};
