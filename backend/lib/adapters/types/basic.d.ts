import { CamsSession } from '../../../../common/src/cams/session';
import { ApplicationConfiguration } from '../../configs/application-configuration';
import { Closable } from '../../deferrable/defer-close';
import { Releasable } from '../../use-cases/gateways.types';
import { LoggerImpl } from '../services/logger.service';
import { CamsHttpRequest } from './http';

export interface ApplicationContext<B = unknown> {
  closables: Closable[];
  config: ApplicationConfiguration;
  extraOutputs: unknown;
  featureFlags: FeatureFlagSet;
  invocationId: string;
  logger: LoggerImpl;
  releasables: Releasable[];
  request?: CamsHttpRequest<B>;
  session?: CamsSession;
}

// This internal interface aligns with the LaunchDarkly LDFlagSet interface that
// types the return of the useFlags hook. It is more restrictive than the `any` type
// used for the value which could include JSON / object literal payloads. If we were
// to use JSON feature flag values out of LaunchDarkly then this definition would
// need to be revisited.
export interface FeatureFlagSet {
  [key: string]: boolean | number | string;
}

export interface ObjectKeyVal {
  [key: string]: number | string | unknown[];
}

export interface ObjectKeyValArrayKeyVal {
  [key: string]: ObjectKeyVal[];
}

export interface RecordObj {
  fieldName: string;
  fieldValue: number | string;
}

export interface ServerType {
  hostname: string;
  port: number;
}
