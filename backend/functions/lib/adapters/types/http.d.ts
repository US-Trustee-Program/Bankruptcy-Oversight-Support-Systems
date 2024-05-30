export interface ApiResponse {
  headers: {
    'Content-Type': string;
    'Last-Modified': string;
  };
  statusCode: number;
  body: object;
}

export interface HttpResponse extends Response {
  data: {
    content?: [];
    status?: number;
  };
  status: number;
}

type CamsDict = { [name: string]: string };
export type CamsHttpRequest<B = unknown> = {
  method: 'GET' | 'POST' | 'DELETE' | 'HEAD' | 'PATCH' | 'PUT' | 'OPTIONS' | 'TRACE' | 'CONNECT';
  url: string;
  headers: CamsDict;
  query: CamsDict;
  params: CamsDict;
  body?: B;
};
