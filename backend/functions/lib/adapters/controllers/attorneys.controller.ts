import { Context } from '@azure/functions';
import { AttorneyPersistenceGateway } from '../types/persistence.gateway';
import proxyData from '../data-access.proxy';
import useCase from '../../use-cases/index';
import log from '../services/logger.service';

const NAMESPACE = 'ATTORNEYS-CONTROLLER';

export class AttorneysController {
  private readonly functionContext: Context;
  private attorneysDb: AttorneyPersistenceGateway;

  constructor(context: Context) {
    this.functionContext = context;
    this.initializeDb();
  }

  private async initializeDb() {
    if (typeof this.attorneysDb == 'undefined') {
      this.attorneysDb = (await proxyData(
        this.functionContext,
        'attorneys',
      )) as AttorneyPersistenceGateway;
      log.info(this.functionContext, NAMESPACE, 'attorneysDB was set successfully');
    }
  }

  public async getAttorneyList(requestQueryFilters: { officeId?: string }) {
    await this.initializeDb();
    log.info(this.functionContext, NAMESPACE, 'Getting Attorneys list.');

    let officeId = '';
    if (requestQueryFilters.officeId) {
      officeId = requestQueryFilters.officeId;
    }

    return await useCase.listAttorneys(this.functionContext, this.attorneysDb, {
      officeId: officeId,
    });
  }
}
