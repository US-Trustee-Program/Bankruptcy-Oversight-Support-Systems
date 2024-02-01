import { Context } from '@azure/functions';
import { ApplicationContext } from '../types/basic';
import { ApplicationConfiguration } from '../../configs/application-configuration';
import { getFeatureFlags } from './feature-flag';
import { LoggerImpl } from '../services/logger.service';

export async function applicationContextCreator(
  functionContext: Context,
): Promise<ApplicationContext> {
  const config = new ApplicationConfiguration();
  const featureFlags = await getFeatureFlags(config);
  const logger = new LoggerImpl(functionContext.log);

  return {
    ...functionContext,
    config,
    featureFlags,
    logger,
  } satisfies ApplicationContext;
}
