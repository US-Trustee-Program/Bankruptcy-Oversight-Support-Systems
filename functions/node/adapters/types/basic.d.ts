import { IDbConfig } from './database.d';

export type LogContext = {
  log: Function;
}

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

export type ObjectKeyVal = {
  [key: string]: string | number;
};
export type ObjectKeyValArrayKeyVal = {
  [key: string]: ObjectKeyVal[];
};
