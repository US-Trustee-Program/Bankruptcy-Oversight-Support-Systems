import { ApplicationContext } from '../types/basic';
import log from '../services/logger.service';
import { CourtCaseManagement } from '../../use-cases/case-management';
import InvalidChapterCaseList from '../../use-cases/invalid-chapter.case-list';

const MODULE_NAME = 'CASES-CONTROLLER';

export class CasesController {
  private readonly context: ApplicationContext;

  constructor(context: ApplicationContext) {
    this.context = context;
  }

  public async getCaseList(requestQueryFilters: { caseChapter: string }) {
    log.info(this.context, MODULE_NAME, 'Getting case list.');
    if (requestQueryFilters.caseChapter == '15') {
      const chapter15CaseList = new CourtCaseManagement();
      return await chapter15CaseList.getChapter15CaseList(this.context);
    } else {
      const invalidChapterCaseList = new InvalidChapterCaseList();
      return invalidChapterCaseList.returnInvalidChapterResponse();
    }
  }

  public async getCaseDetails(requestQueryFilters: { caseId: string }) {
    const chapter15CaseDetail = new CourtCaseManagement();
    return chapter15CaseDetail.getCaseDetail(this.context, requestQueryFilters.caseId);
  }

  public async getAllCases() {
    log.info(this.context, MODULE_NAME, 'Getting all cases');
    const chapter15CaseList = new CourtCaseManagement();
    return await chapter15CaseList.getAllCases(this.context);
  }
}
