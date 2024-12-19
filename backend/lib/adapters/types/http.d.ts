export interface ApiResponse {
  headers: {
    'Content-Type': string;
    'Last-Modified': string;
  };
  statusCode: number;
  body: object;
}

type CamsDict = { [name: string]: string };

export type CamsHttpMethod =
  | 'GET'
  | 'POST'
  | 'DELETE'
  | 'HEAD'
  | 'PATCH'
  | 'PUT'
  | 'OPTIONS'
  | 'TRACE'
  | 'CONNECT';

export type CamsHttpRequest<B = unknown> = {
  method: CamsHttpMethod;
  url: string;
  headers: CamsDict;
  query: CamsDict;
  params: CamsDict;
  body?: B;
};

export type AdminRequestBody = {
  apiKey: string;
};
