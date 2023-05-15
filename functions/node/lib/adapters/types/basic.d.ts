import { IDbConfig } from './database';

export type Context = {
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
  get: Function;
};

export type ObjectKeyVal = {
  [key: string]: string | number;
};
export type ObjectKeyValArrayKeyVal = {
  [key: string]: ObjectKeyVal[];
};
