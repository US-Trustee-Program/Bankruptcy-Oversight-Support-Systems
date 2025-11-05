import { ApplicationConfiguration } from '../configs/application-configuration';
import { LoggerImpl } from '../adapters/services/logger.service';
import { CamsSession } from '../../../common/src/cams/session';
import { CamsHttpRequest } from '../adapters/types/http';
import { Closable } from '../deferrable/defer-close';
import { Releasable } from './gateways.types';
import { FeatureFlagSet as _FeatureFlagSet } from '../adapters/types/basic';

export type FeatureFlagSet = _FeatureFlagSet;

export interface ApplicationContext<B = unknown> {
  config: ApplicationConfiguration;
  featureFlags: FeatureFlagSet;
  logger: LoggerImpl;
  session?: CamsSession;
  invocationId: string;
  request?: CamsHttpRequest<B>;
  closables: Closable[];
  releasables: Releasable[];
  extraOutputs: unknown;
}
