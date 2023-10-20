import { ApplicationContext } from '../types/basic';
import log from '../services/logger.service';
import { CourtCaseManagement } from '../../use-cases/case-management';
import InvalidChapterCaseList from '../../use-cases/invalid-chapter.case-list';

const MODULE_NAME = 'CASES-CONTROLLER';

export class CasesController {
  private readonly context: ApplicationContext;
  private readonly courtCaseManagement: CourtCaseManagement;

  constructor(context: ApplicationContext) {
    this.context = context;
    this.courtCaseManagement = new CourtCaseManagement();
  }

  public async getCaseList(requestQueryFilters: { caseChapter: string }) {
    log.info(this.context, MODULE_NAME, 'Getting case list.');
    if (requestQueryFilters.caseChapter == '15') {
      return await this.courtCaseManagement.getChapter15CaseList(this.context);
    } else {
      const invalidChapterCaseList = new InvalidChapterCaseList();
      return invalidChapterCaseList.returnInvalidChapterResponse();
    }
  }

  public async getCaseDetails(requestQueryFilters: { caseId: string }) {
    return this.courtCaseManagement.getCaseDetail(this.context, requestQueryFilters.caseId);
  }

  public async getCases() {
    log.info(this.context, MODULE_NAME, 'Getting all cases');
    return await this.courtCaseManagement.getCases(this.context);
  }
}
