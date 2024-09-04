// TODO:  All of These are probably unused interfaces now
export interface SimpleResponseData<T = object> {
  success: boolean;
  body: T;
}

export interface ResponseData<T = object> {
  message: string;
  count: number;
  body: T | Array<T>;
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
