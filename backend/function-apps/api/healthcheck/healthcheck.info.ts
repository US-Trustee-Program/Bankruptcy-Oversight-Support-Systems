import * as dotenv from 'dotenv';

import { ApplicationContext } from '../../../lib/adapters/types/basic';

dotenv.config();

const MODULE_NAME = 'HEALTHCHECK-INFO';

export default class HealthcheckInfo {
  private readonly applicationContext: ApplicationContext;

  constructor(applicationContext: ApplicationContext) {
    this.applicationContext = applicationContext;
  }

  public getServiceInfo() {
    const info = {
      branch: process.env.INFO_BRANCH || '',
      releasedTimestamp: process.env.INFO_RELEASED_TIMESTAMP || '',
      sha: process.env.INFO_SHA || '',
      version: process.env.INFO_VERSION || '',
    };
    this.applicationContext.logger.info(MODULE_NAME, `Api Commit sha ${info.sha}`);
    return info;
  }
}
