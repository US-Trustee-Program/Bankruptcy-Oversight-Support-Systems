import { Context } from '@azure/functions';
import { IDbConfig } from './database';

export type AppConfig = {
  dbMock: boolean;
  dbConfig: IDbConfig;
  pacerMock: boolean;
  server: ServerType;
  get: Function;
};

export interface ApplicationContext extends Context {
  config: AppConfig;
}

export type ObjectKeyVal = {
  [key: string]: string | number;
};
export type ObjectKeyValArrayKeyVal = {
  [key: string]: ObjectKeyVal[];
};

export type RecordObj = {
  fieldName: string;
  fieldValue: string | number;
};

export type ServerType = {
  hostname: string;
  port: number;
};
