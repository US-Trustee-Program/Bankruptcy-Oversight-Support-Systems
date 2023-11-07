import { Context } from '@azure/functions';
import { ApplicationContext } from '../types/basic';
import { ApplicationConfiguration } from '../../configs/application-configuration';
import { getFeatureFlags } from './feature-flag';

export async function applicationContextCreator(
  functionContext: Context,
): Promise<ApplicationContext> {
  const config = new ApplicationConfiguration();
  const featureFlags = await getFeatureFlags(config);

  const appContext = {
    ...functionContext,
    config,
    featureFlags,
  } as ApplicationContext;
  return appContext;
}
