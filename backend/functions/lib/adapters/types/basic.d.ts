import { ApplicationConfiguration } from '../../configs/application-configuration';
import { Context } from '@azure/functions';
import { IDbConfig } from './database';
import { CaseAssignmentCosmosDbRepository } from '../gateways/case.assignment.cosmosdb.repository';

export interface AppConfig {
  dbMock: boolean;
  acmsDbConfig: IDbConfig;
  dxtrDbConfig: IDbConfig;
  server: ServerType;
}

export interface ApplicationContext extends Context {
  config: ApplicationConfiguration;
  caseAssignmentRepository: CaseAssignmentCosmosDbRepository;
}

export interface ObjectKeyVal {
  [key: string]: string | number | unknown[];
}
export interface ObjectKeyValArrayKeyVal {
  [key: string]: ObjectKeyVal[];
}

export interface RecordObj {
  fieldName: string;
  fieldValue: string | number;
}

export interface ServerType {
  hostname: string;
  port: number;
}
