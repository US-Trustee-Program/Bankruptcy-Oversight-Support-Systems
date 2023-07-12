import { Context } from '@azure/functions';
import { ApplicationContext } from '../types/basic';
import config from '../../configs/index';

export default class ApplicationContextCreator {
  private constructor() {}

  public static setup(functionContext: Context) {
    const appContext = functionContext as ApplicationContext;
    appContext.config = config;
    return appContext;
  }
}
