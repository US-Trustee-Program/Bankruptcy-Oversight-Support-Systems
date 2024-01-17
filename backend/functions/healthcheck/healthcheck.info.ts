import * as dotenv from 'dotenv';
import { ApplicationContext } from '../lib/adapters/types/basic';
import log from '../lib/adapters/services/logger.service';

dotenv.config();

const MODULE_NAME = 'HEALTHCHECK-INFO';

export default class HealthcheckInfo {
  private readonly applicationContext: ApplicationContext;

  constructor(applicationContext: ApplicationContext) {
    this.applicationContext = applicationContext;
  }

  public getServiceInfo() {
    const info = {
      version: process.env.INFO_VERSION || '',
      branch: process.env.INFO_BRANCH || '',
      sha: process.env.INFO_SHA || '',
      releasedTimestamp: process.env.INFO_RELEASED_TIMESTAMP || '',
    };
    log.info(this.applicationContext, MODULE_NAME, `Api Commit sha ${info.sha}`);
    return info;
  }
}
