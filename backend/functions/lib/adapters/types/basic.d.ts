import { ApplicationConfiguration } from '../../configs/application-configuration';
import { Context } from '@azure/functions';
import { IDbConfig } from './database';
import { CamsError } from '../../common-errors/cams-error';
import { CamsSession } from '../../../../../common/src/cams/session';

export interface AppConfig {
  dbMock: boolean;
  dxtrDbConfig: IDbConfig;
  server: ServerType;
}

export interface LoggerHelper {
  debug: (moduleName: string, message: string, data?: unknown) => void;
  info: (moduleName: string, message: string, data?: unknown) => void;
  warn: (moduleName: string, message: string, data?: unknown) => void;
  error: (moduleName: string, message: string, data?: unknown) => void;
  camsError: (error: CamsError) => void;
}

// TODO: By extending Context from Azure Functions we have allowed Azure to invade this codebase.
export interface ApplicationContext extends Context {
  config: ApplicationConfiguration;
  featureFlags: FeatureFlagSet;
  logger: LoggerHelper;
  session?: CamsSession;
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
