export type HttpResponse = {
  headers: {
    'Content-Type': String;
    'Last-Modified': String;
  };
  statusCode: number;
  body: Object;
};
