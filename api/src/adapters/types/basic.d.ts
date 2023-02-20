export type ServerType = {
  hostname: string;
  port: number;
};

export type RecordObj = {
  fieldName: string;
  fieldValue: string | number;
};

export type AppConfig = {
  dbMock: boolean;
  dbConfig: IDbConfig;
  server: ServerType;
};
