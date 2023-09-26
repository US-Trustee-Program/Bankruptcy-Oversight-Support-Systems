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

export interface Chapter15CaseInterface extends ObjectKeyVal {
  caseNumber: string;
  caseTitle: string;
  dateFiled: string;
  assignments: string[];
}
