import { ObjectKeyVal } from "./basic";

// TODO: make this implement the IRecordSet<any> interface
export type CaseListRecordSet = {
  staff1Label: string;
  staff2Label: string;
  caseList: ObjectKeyVal[];
  initialized: boolean;
}

export type CaseListDbResult = {
  success: boolean;
  message: string;
  count: number;
  body: CaseListRecordSet;
};

export type caseType = {
  currentCaseChapter: string;
  caseNumber: string;
  debtor1Name: string;
  currentChapterFileDate: number;
  staff1ProfName: string;
  staff1ProfTypeDescription: string;
  staff2ProfName: string;
  staff2ProfTypeDescription: string;
  hearingDate: number;
  hearingTime: number;
  hearingCode: string;
  hearingDisposition: string;
  //hearingDescription: string;
};

export type caseTypeWithDescription = {
  currentCaseChapter: string;
  caseNumber: string;
  debtor1Name: string;
  currentChapterFileDate: number;
  staff1ProfName: string;
  staff1ProfTypeDescription: string;
  staff2ProfName: string;
  staff2ProfTypeDescription: string;
  hearingDate: number;
  hearingTime: number;
  hearingCode: string;
  hearingDisposition: string;
  hearingDescription: string;
};