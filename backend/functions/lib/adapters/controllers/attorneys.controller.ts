import { ApplicationContext } from '../types/basic';
import { applicationContextCreator } from '../utils/application-context-creator';
import { Context } from '@azure/functions';
import useCase from '../../use-cases/index';
import log from '../services/logger.service';

const NAMESPACE = 'ATTORNEYS-CONTROLLER';

export class AttorneysController {
  private readonly applicationContext: ApplicationContext;

  constructor(context: Context) {
    this.applicationContext = applicationContextCreator(context);
  }

  public async getAttorneyList(requestQueryFilters: { officeId?: string }) {
    log.info(this.applicationContext, NAMESPACE, 'Getting Attorneys list.');

    let officeId = '';
    if (requestQueryFilters.officeId) {
      officeId = requestQueryFilters.officeId;
    }

    return await useCase.listAttorneys(this.applicationContext, {
      officeId: officeId,
    });
  }
}
