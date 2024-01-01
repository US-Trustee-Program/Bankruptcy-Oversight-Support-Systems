import { CaseDocketEntry } from '../case-docket/case-docket.model';

export type Order = CaseDocketEntry & {
  caseId: string;
  caseTitle: string;
  chapter: string;
  courtName: string;
  courtDivisionName: string;
  regionId: string;
  orderType: 'transfer';
  orderDate: string;
  status: 'pending' | 'approved' | 'rejected';
  newCaseId?: string;
};

export type OrderSync = {
  orders: Order[];
  maxTxId: number;
};

export type OrderSyncState = {
  id: string;
  txId: number;
  documentType: string;
};
