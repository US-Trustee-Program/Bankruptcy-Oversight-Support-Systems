import { ObjectKeyVal } from "./basic";

// TODO: make this implement the IRecordSet<any> interface
export interface CaseListRecordSet {
  staff1Label?: string;
  staff2Label?: string;
  caseList: ObjectKeyVal[];
  initialized?: boolean;
}

export type CaseListDbResult = {
  success: boolean;
  message: string;
  count: number;
  body: CaseListRecordSet;
}

export type Chapter11CaseType = {
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
  //hearingDescription: string;
};

export type Chapter11CaseTypeWithDescription = {
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

export type Chapter15Case = {
  caseNumber: string;
  caseTitle: string;
  dateFiled: string;
}

export type PacerCaseData = {
  courtId?: string;
  caseId?: number;
  caseYear: number;
  caseNumber: number;
  caseOffice?: string;
  caseType?: string;
  caseTitle: string;
  dateFiled: string;
  dateReopened?: string;
  dateDischarged?: string;
  bankruptcyChapter?: string;
  jointBankruptcyFlag?: string;
  jurisdictionType?: string;
  caseNumberFull?: string;
}
