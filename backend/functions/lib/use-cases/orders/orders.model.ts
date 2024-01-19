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
  sequenceNumber: number;
  status: OrderStatus;
  newCaseId?: string;
  newCourtName?: string;
  newCourtDivisionName?: string;
  newDivisionCode?: string;
  newRegionId?: string;
  newRegionName?: string;
  reason?: string;
};

export type OrderTransfer = {
  id: string;
  sequenceNumber: number;
  caseId: string;
  newCaseId: string;
  newCourtName: string;
  newCourtDivisionName: string;
  newDivisionCode: string;
  newRegionId: string;
  newRegionName: string;
  status: OrderStatus;
  reason?: string;
};

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
  orders: Order[];
  maxTxId: string;
};
