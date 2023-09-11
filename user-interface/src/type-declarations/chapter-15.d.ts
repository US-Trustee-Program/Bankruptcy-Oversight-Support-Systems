import { ResponseData } from './api';

export interface Chapter15Type {
  caseNumber: string;
  caseTitle: string;
  dateFiled: string;
  assignments?: string[];
}

export interface Chapter15CaseListResponseData extends ResponseData {
  body: {
    caseList: Array<object>;
  };
}
