export type ServerType = {
  hostname: string;
  port: number;
}

export type AppConfig = {
  dbMock: boolean;
  dbConfig: Object;
  server: ServerType;
}

export type RecordObj = {
  fieldName: string;
  fieldValue: string | number;
}

export type DbRecord = {
  message: string;
  count: number;
  body: Object;
  success: boolean;
}