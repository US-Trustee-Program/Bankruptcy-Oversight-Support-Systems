import { CaseDocketEntry } from '../case-docket/case-docket.model';

export type OrderStatus = 'pending' | 'approved' | 'rejected';

export type Order = CaseDocketEntry & {
  id?: string;
  caseId: string;
  caseTitle: string;
  chapter: string;
  courtName: string;
  courtDivisionName: string;
  regionId: string;
  orderType: 'transfer';
  orderDate: string;
  status: OrderStatus;
  newCaseId?: string;
};

export type OrderTransfer = {
  id: string;
  sequenceNumber: string;
  caseId: string;
  newCaseId: string;
  newCourtName: string;
  newCourtDivisionName: string;
  status: OrderStatus;
};

export type OrderSync = {
  orders: Order[];
  maxTxId: number;
};
