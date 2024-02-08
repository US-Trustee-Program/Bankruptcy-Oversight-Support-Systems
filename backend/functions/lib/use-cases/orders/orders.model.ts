import { CaseDetailInterface } from '../../adapters/types/cases';
import { CaseDocketEntry } from '../case-docket/case-docket.model';

export type OrderStatus = 'pending' | 'approved' | 'rejected';
export type OrderType = 'transfer' | 'consolidation';

// TODO: Consider modeling a CaseDetailSummary in cases.d.ts and use it here instead of CaseDetailInterface

export type TransferOrder = CaseDetailInterface & {
  id?: string;
  orderType: 'transfer';
  orderDate: string;
  status: OrderStatus;
  docketEntries: CaseDocketEntry[];
  newCaseId?: string;
  newCase?: Partial<CaseDetailInterface>;
  reason?: string;
};

export type ConsolidationOrder = CaseDetailInterface & {
  orderType: 'consolidation';
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
  newCase?: Partial<CaseDetailInterface>;
  status: 'approved';
};

export type TransferOrderAction = TransferOrderActionRejection | TransferOrderActionApproval;

export interface Transfer {
  caseId: string;
  otherCaseId: string;
  orderDate: string;
  divisionName: string;
  courtName: string;
}

export type TransferIn = Transfer & {
  documentType: 'TRANSFER_IN';
};

export type TransferOut = Transfer & {
  documentType: 'TRANSFER_OUT';
};

export type OrderSync = {
  orders: TransferOrder[];
  maxTxId: string;
};
