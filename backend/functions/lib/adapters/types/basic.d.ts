import { ApplicationConfiguration } from '../../configs/application-configuration';
import { Context } from '@azure/functions';
import { IDbConfig } from './database';
import { CaseAssignmentLocalRepository } from '../gateways/case.assignment.local.repository';

export interface AppConfig {
  dbMock: boolean;
  dbConfig: IDbConfig;
  pacerMock: boolean;
  server: ServerType;
}

export interface ApplicationContext extends Context {
  config: ApplicationConfiguration;
  caseAssignmentRepository: CaseAssignmentLocalRepository;
}

export interface ObjectKeyVal {
  [key: string]: string | number;
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
