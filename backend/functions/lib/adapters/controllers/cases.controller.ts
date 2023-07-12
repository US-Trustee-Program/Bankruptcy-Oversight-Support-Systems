import { ApplicationContext, RecordObj } from '../types/basic';
import { applicationContextCreator } from '../utils/application-context-creator';
import { CasePersistenceGateway } from '../types/persistence.gateway';
import { Context } from '@azure/functions';
import log from '../services/logger.service';
import proxyData from '../data-access.proxy';
import useCase from '../../use-cases/index';

const NAMESPACE = 'CASES-CONTROLLER';

export class CasesController {
  private readonly applicationContext: ApplicationContext;
  private casesDb: CasePersistenceGateway;

  constructor(context: Context) {
    this.applicationContext = applicationContextCreator(context);
    this.initializeDb();
  }

  private async initializeDb() {
    if (typeof this.casesDb == 'undefined') {
      this.casesDb = (await proxyData(this.applicationContext, 'cases')) as CasePersistenceGateway;
      log.info(this.applicationContext, NAMESPACE, 'casesDB was set successfully');
    }
  }

  public async getCaseList(requestQueryFilters: { caseChapter: string; professionalId: string }) {
    await this.initializeDb();
    log.info(this.applicationContext, NAMESPACE, 'Getting case list.');

    let professionalId = '';
    let caseChapter = '';
    if (requestQueryFilters.professionalId) {
      professionalId = requestQueryFilters.professionalId;
    }
    if (requestQueryFilters.caseChapter) {
      caseChapter = requestQueryFilters.caseChapter;
    }
    return await useCase.listCases(this.applicationContext, this.casesDb, {
      chapter: caseChapter,
      professionalId: professionalId,
    });
  }
}
