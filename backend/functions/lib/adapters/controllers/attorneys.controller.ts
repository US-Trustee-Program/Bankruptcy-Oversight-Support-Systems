import { Context } from '@azure/functions';
import useCase from '../../use-cases/index';
import log from '../services/logger.service';

const NAMESPACE = 'ATTORNEYS-CONTROLLER';

export class AttorneysController {
  private readonly functionContext: Context;

  constructor(context: Context) {
    this.functionContext = context;
  }

  public async getAttorneyList(requestQueryFilters: { officeId?: string }) {
    log.info(this.functionContext, NAMESPACE, 'Getting Attorneys list.');

    let officeId = '';
    if (requestQueryFilters.officeId) {
      officeId = requestQueryFilters.officeId;
    }

    return await useCase.listAttorneys(this.functionContext, {
      officeId: officeId,
    });
  }
}
