import { ResponseData } from './api';

export interface Chapter15Type {
  caseId: string;
  caseTitle: string;
  dateFiled: string;
  assignments?: string[];
}

interface CaseDetailType {
  caseId: string;
  caseTitle: string;
  dateFiled: string;
  dateClosed: string;
  assignedStaff: string[];
}

export interface Chapter15CaseListResponseData extends ResponseData {
  body: {
    caseList: Array<object>;
  };
}

export interface Chapter15CaseDetailsResponseData extends ResponseData {
  body: {
    caseDetails: CaseDetailType;
  };
}
