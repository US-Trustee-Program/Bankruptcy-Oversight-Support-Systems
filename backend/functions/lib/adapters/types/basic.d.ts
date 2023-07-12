import { ApplicationConfiguration } from '../../configs/application-configuration';
import { Context } from '@azure/functions';
import { IDbConfig } from './database';

export interface AppConfig {
  dbMock: boolean;
  dbConfig: IDbConfig;
  pacerMock: boolean;
  server: ServerType;
}

export interface ApplicationContext extends Context {
  config: ApplicationConfiguration;
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
