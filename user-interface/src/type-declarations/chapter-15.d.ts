import { ResponseData } from './api';

export interface Chapter15Type {
  caseId: string;
  chapter?: string;
  caseTitle: string;
  dateFiled: string;
  assignments?: string[];
}

interface CaseDetailType {
  caseId: string;
  chapter: string;
  caseTitle: string;
  dateFiled: string;
  judgeName?: string;
  closedDate?: string;
  dismissedDate?: string;
  reopenedDate?: string;
  assignments: string[];
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
export interface StaffType {
  name: string;
  type: string;
}
