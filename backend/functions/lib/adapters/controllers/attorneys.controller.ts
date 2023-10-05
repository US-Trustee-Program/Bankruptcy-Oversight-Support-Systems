import { ApplicationContext } from '../types/basic';
import { applicationContextCreator } from '../utils/application-context-creator';
import { Context } from '@azure/functions';
import AttorneysList from '../../use-cases/attorneys';
import log from '../services/logger.service';
import { AttorneyListDbResult } from '../types/attorneys';

const MODULE_NAME = 'ATTORNEYS-CONTROLLER';

export class AttorneysController {
  private readonly applicationContext: ApplicationContext;

  constructor(context: Context) {
    this.applicationContext = applicationContextCreator(context);
  }

  public async getAttorneyList(requestQueryFilters: {
    officeId?: string;
  }): Promise<AttorneyListDbResult> {
    log.info(this.applicationContext, MODULE_NAME, 'Getting Attorneys list.');
    const attorneysList = new AttorneysList();
    return await attorneysList.getAttorneyList(this.applicationContext, requestQueryFilters);
  }
}
