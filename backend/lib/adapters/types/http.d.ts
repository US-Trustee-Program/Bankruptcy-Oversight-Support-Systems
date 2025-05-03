export interface ApiResponse {
  body: object;
  headers: {
    'Content-Type': string;
    'Last-Modified': string;
  };
  statusCode: number;
}

export type CamsHttpMethod =
  | 'CONNECT'
  | 'DELETE'
  | 'GET'
  | 'HEAD'
  | 'OPTIONS'
  | 'PATCH'
  | 'POST'
  | 'PUT'
  | 'TRACE';

export type CamsHttpRequest<B = unknown> = {
  body?: B;
  headers: CamsDict;
  method: CamsHttpMethod;
  params: CamsDict;
  query: CamsDict;
  url: string;
};

type CamsDict = { [name: string]: string };
