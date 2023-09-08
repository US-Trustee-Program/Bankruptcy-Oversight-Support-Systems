import { ObjectKeyVal } from './basic';

// TODO: make this implement the IRecordSet<any> interface
export interface CaseListRecordSet {
  caseList: ObjectKeyVal[];
  initialized?: boolean;
}

export interface Chapter11CaseListRecordSet extends CaseListRecordSet {
  staff1Label?: string;
  staff2Label?: string;
}

export interface CaseListDbResult {
  success: boolean;
  message: string;
  count: number;
  body: CaseListRecordSet;
}

export interface Chapter11CaseListDbResult {
  success: boolean;
  message: string;
  count: number;
  body: Chapter11CaseListRecordSet;
}

export interface Chapter11CaseType extends ObjectKeyVal {
  caseNumber: string;
  currentCaseChapter: string;
  currentChapterFileDate: number;
  debtor1Name: string;
  staff1ProfName: string;
  staff1ProfTypeDescription: string;
  staff2ProfName: string;
  staff2ProfTypeDescription: string;
  hearingDate: number;
  hearingTime: number;
  hearingCode: string;
  hearingDisposition: string;
}

export interface Chapter11CaseTypeWithDescription extends Chapter11CaseType {
  hearingDescription: string;
}

export interface Chapter15CaseInterface extends ObjectKeyVal {
  caseNumber: string;
  caseTitle: string;
  dateFiled: string;
  assignments: string[];
}
