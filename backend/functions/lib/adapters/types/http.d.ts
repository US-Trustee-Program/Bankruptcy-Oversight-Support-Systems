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
