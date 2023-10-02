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

  public async getCaseList(requestQueryFilters: { caseChapter: string; professionalId: string }) {
    log.info(this.applicationContext, NAMESPACE, 'Getting case list.');

    let professionalId = '';
    let caseChapter = '';
    if (requestQueryFilters.professionalId) {
      professionalId = requestQueryFilters.professionalId;
    }
    if (requestQueryFilters.caseChapter) {
      caseChapter = requestQueryFilters.caseChapter;
    }
    return await useCase.listCases(this.applicationContext, {
      chapter: caseChapter,
      professionalId: professionalId,
    });
  }

  public async getCaseDetails(requestQueryFilters: { caseId: string }) {
    return {};
  }
}
