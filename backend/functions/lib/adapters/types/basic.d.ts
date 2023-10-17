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
  featureFlags: FeatureFlagSet;
}

export interface ObjectKeyVal {
  [key: string]: string | number | unknown[];
}

export interface ObjectKeyValArrayKeyVal {
  [key: string]: ObjectKeyVal[];
}

// This internal interface aligns with the LaunchDarkly LDFlagSet interface that
// types the return of the useFlags hook. It is more restrictive than the `any` type
// used for the value which could include JSON / object literal payloads. If we were
// to use JSON feature flag values out of LaunchDarkly then this definition would
// need to be revisited.
export interface FeatureFlagSet {
  [key: string]: boolean | string | number;
}

export interface RecordObj {
  fieldName: string;
  fieldValue: string | number;
}

export interface ServerType {
  hostname: string;
  port: number;
}
