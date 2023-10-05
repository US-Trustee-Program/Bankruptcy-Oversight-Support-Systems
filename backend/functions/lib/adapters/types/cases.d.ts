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
    caseDetails: Chapter15CaseInterface;
  };
}

export interface Chapter15CaseInterface extends ObjectKeyVal {
  caseId: string;
  caseTitle: string;
  dateFiled: string;
  closedDate?: string;
  dismissedDate?: string;
  dxtrId?: string;
  courtId?: string;
  assignments: string[];
}

export interface DxtrTransactionRecord {
  txRecord: string;
  txCode: string;
}
