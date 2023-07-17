export interface PacerCaseData {
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

export interface PacerLoginResponse {
  nextGenCSO: string;
  loginResult: string;
}
