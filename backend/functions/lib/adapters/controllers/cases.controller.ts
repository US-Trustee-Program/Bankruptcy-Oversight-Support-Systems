import log from '../services/logger.service';
import useCase from '../../use-cases/index';
import { CasePersistenceGateway } from '../types/persistence.gateway';
import proxyData from '../data-access.proxy';
import { Context, RecordObj } from '../types/basic';

const NAMESPACE = 'CASES-CONTROLLER';

export class CasesController {
  private readonly functionContext: Context;
  private casesDb: CasePersistenceGateway;

  constructor(context: Context) {
    this.functionContext = context;
    this.initializeDb();
  }

  private async initializeDb() {
    if (typeof this.casesDb == 'undefined') {
      this.casesDb = (await proxyData(this.functionContext, 'cases')) as CasePersistenceGateway;
      log.info(this.functionContext, NAMESPACE, 'casesDB was set successfully');
    }
  }

  public async getCaseList(requestQueryFilters: { caseChapter: string; professionalId: string }) {
    await this.initializeDb();
    log.info(this.functionContext, NAMESPACE, 'Getting case list.');

    let professionalId = '';
    let caseChapter = '';
    if (requestQueryFilters.professionalId) {
      professionalId = requestQueryFilters.professionalId;
    }
    if (requestQueryFilters.caseChapter) {
      caseChapter = requestQueryFilters.caseChapter;
    }
    return await useCase.listCases(this.functionContext, this.casesDb, {
      chapter: caseChapter,
      professionalId: professionalId,
    });
  }
}
