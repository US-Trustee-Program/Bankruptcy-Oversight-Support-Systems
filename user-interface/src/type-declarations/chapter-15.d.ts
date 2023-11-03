import { ResponseData } from './api';

export interface Chapter15Type {
  caseId: string;
  chapter?: string;
  caseTitle: string;
  dateFiled: string;
  assignments?: string[];
}

export interface Debtor {
  name: string;
  address1?: string;
  address2?: string;
  address3?: string;
  address4?: string;
  taxid?: string;
  ssn?: string;
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
  debtor: Debtor;
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
