import { ObjectKeyVal } from './basic';

// TODO: make this implement the IRecordSet<any> interface
export interface CaseListRecordSet {
  caseList: ObjectKeyVal[];
  initialized?: boolean;
}

export interface CaseListDbResult {
  success: boolean;
  message: string;
  count: number;
  body: CaseListRecordSet;
}

export interface CaseDetailsDbResult {
  success: boolean;
  message: string;
  body: {
    caseDetails: CaseDetailInterface;
  };
}

export interface CaseDetailInterface extends ObjectKeyVal {
  caseId: string;
  chapter: string;
  caseTitle: string;
  dateFiled: string;
  closedDate?: string;
  dismissedDate?: string;
  reopenedDate?: string;
  dxtrId?: string;
  courtId?: string;
  assignments?: string[];
  judgeName?: string;
}

export interface DxtrTransactionRecord {
  txRecord: string;
  txCode: string;
}
