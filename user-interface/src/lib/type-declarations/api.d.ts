export interface SimpleResponseData {
  success: boolean;
  body: Array<object>;
}
export interface ResponseData {
  message: string;
  count: number;
  body: object | Array<object>;
}

export interface ResponseError {
  message: string;
  error: object;
}

export interface CaseListResponseData extends ResponseData {
  body: {
    staff1Label: string;
    staff2Label: string;
    caseList: Array<object>;
  };
}
