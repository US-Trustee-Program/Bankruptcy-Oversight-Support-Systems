import { Context } from '@azure/functions';
import { ApplicationContext } from '../types/basic';
import { ApplicationConfiguration } from '../../configs/application-configuration';

export function applicationContextCreator(functionContext: Context) {
  const appContext = functionContext as ApplicationContext;
  const applicationConfiguration = new ApplicationConfiguration();
  appContext.config = applicationConfiguration;
  return appContext;
}
