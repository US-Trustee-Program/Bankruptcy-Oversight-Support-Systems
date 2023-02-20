export type HttpResponse = {
  headers: {
    ContentType: String;
    LastModified: String;
  };
  statusCode: number;
  body: Object;
};
