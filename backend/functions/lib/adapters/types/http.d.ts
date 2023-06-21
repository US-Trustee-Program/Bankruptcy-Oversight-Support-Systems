export type ApiResponse = {
  headers: {
    'Content-Type': String;
    'Last-Modified': String;
  };
  statusCode: number;
  body: Object;
};

export interface HttpResponse extends Response {
  data: {
    content?: [];
    status?: number;
  };
  status: number;
}
