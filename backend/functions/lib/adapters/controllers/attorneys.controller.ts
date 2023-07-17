import { ApplicationContext } from '../types/basic';
import { applicationContextCreator } from '../utils/application-context-creator';
import { Context } from '@azure/functions';
import useCase from '../../use-cases/index';
import log from '../services/logger.service';
import { AttorneyListDbResult } from '../types/attorneys';

const NAMESPACE = 'ATTORNEYS-CONTROLLER';

export class AttorneysController {
  private readonly applicationContext: ApplicationContext;

  constructor(context: Context) {
    this.applicationContext = applicationContextCreator(context);
  }

  public async getAttorneyList(requestQueryFilters: {
    officeId?: string;
  }): Promise<AttorneyListDbResult> {
    log.info(this.applicationContext, NAMESPACE, 'Getting Attorneys list.');

    const attorneysList = await useCase.listAttorneys(this.applicationContext, requestQueryFilters);
    return attorneysList;
  }
}
