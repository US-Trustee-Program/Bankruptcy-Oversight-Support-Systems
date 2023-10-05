import { ApplicationContext } from '../types/basic';
import { applicationContextCreator } from '../utils/application-context-creator';
import { Context } from '@azure/functions';
import log from '../services/logger.service';
import { Chapter15CaseList } from '../../use-cases/chapter-15.case';
import InvalidChapterCaseList from '../../use-cases/invalid-chapter.case-list';

const MODULE_NAME = 'CASES-CONTROLLER';

export class CasesController {
  private readonly applicationContext: ApplicationContext;

  constructor(context: Context) {
    this.applicationContext = applicationContextCreator(context);
  }

  public async getCaseList(requestQueryFilters: { caseChapter: string }) {
    log.info(this.applicationContext, MODULE_NAME, 'Getting case list.');
    if (requestQueryFilters.caseChapter == '15') {
      const chapter15CaseList = new Chapter15CaseList();
      return await chapter15CaseList.getChapter15CaseList(this.applicationContext);
    } else {
      const invalidChapterCaseList = new InvalidChapterCaseList();
      return invalidChapterCaseList.returnInvalidChapterResponse();
    }
  }

  public async getCaseDetails(requestQueryFilters: { caseId: string }) {
    const chapter15CaseDetail = new Chapter15CaseList();
    return chapter15CaseDetail.getChapter15CaseDetail(
      this.applicationContext,
      requestQueryFilters.caseId,
    );
  }
}
