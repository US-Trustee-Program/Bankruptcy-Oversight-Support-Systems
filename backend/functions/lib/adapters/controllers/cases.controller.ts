import { ApplicationContext } from '../types/basic';
import { applicationContextCreator } from '../utils/application-context-creator';
import { Context } from '@azure/functions';
import log from '../services/logger.service';
import useCase from '../../use-cases/index';

const NAMESPACE = 'CASES-CONTROLLER';

export class CasesController {
  private readonly applicationContext: ApplicationContext;

  constructor(context: Context) {
    this.applicationContext = applicationContextCreator(context);
  }

  public async getCaseList(requestQueryFilters: { caseChapter: string }) {
    log.info(this.applicationContext, NAMESPACE, 'Getting case list.');

    return await useCase.listCases(this.applicationContext, {
      chapter: requestQueryFilters.caseChapter,
    });
  }

  public async getCaseDetails(requestQueryFilters: { caseId: string }) {
    return {
      requestQueryFilters,
    };
  }
}
