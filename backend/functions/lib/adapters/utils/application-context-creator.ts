import { Context } from '@azure/functions';
import { ApplicationContext } from '../types/basic';
import { ApplicationConfiguration } from '../../configs/application-configuration';

export function applicationContextCreator(functionContext: Context) {
  return {
    ...functionContext,
    config: new ApplicationConfiguration(),
  } as ApplicationContext;
}
