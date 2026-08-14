import { ApplicationConfiguration } from '../../configs/application-configuration';
import { CamsSession } from '@common/cams/session';
import { CamsHttpRequest } from './http';
import { Closable } from '../../deferrable/defer-close';
import { ObservabilityGateway, Releasable } from '../../use-cases/gateways.types';
import { LoggerImpl } from '../services/logger.service';

export interface ExtraOutputs {
  set(output: unknown, value: unknown): void;
}

export interface ApplicationContext<B = unknown> {
  config: ApplicationConfiguration;
  featureFlags: FeatureFlagSet;
  logger: LoggerImpl;
  observability: ObservabilityGateway;
  session?: CamsSession;
  invocationId: string;
  request?: CamsHttpRequest<B>;
  closables: Closable[];
  releasables: Releasable[];
  extraOutputs: ExtraOutputs;
  /**
   * Queue names this invocation's own Azure Functions registration declared in its
   * `extraOutputs` array (from `InvocationContext.options.extraOutputs`), when running under
   * Azure Functions. `context.extraOutputs.set()` never throws for a queue outside this list --
   * the runtime just never serializes it -- so this lets a caller (see
   * ApiToDataflowsGatewayImpl.enqueue) fail loudly instead of silently dropping the write.
   * Undefined outside an Azure Functions invocation (e.g. Express/BDD contexts), where this
   * check cannot be performed.
   */
  registeredExtraOutputQueueNames?: string[];
  notificationWarnings: string[];
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
