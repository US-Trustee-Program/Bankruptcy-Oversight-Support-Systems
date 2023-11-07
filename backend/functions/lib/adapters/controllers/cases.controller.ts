import { ApplicationContext } from '../types/basic';
import log from '../services/logger.service';
import { CaseManagement } from '../../use-cases/case-management';

const MODULE_NAME = 'CASES-CONTROLLER';

export class CasesController {
  private readonly context: ApplicationContext;
  private readonly caseManagement: CaseManagement;

  constructor(context: ApplicationContext) {
    this.context = context;
    this.caseManagement = new CaseManagement(this.context);
  }

  public async getCaseDetails(requestQueryFilters: { caseId: string }) {
    return this.caseManagement.getCaseDetail(this.context, requestQueryFilters.caseId);
  }

  public async getCases() {
    log.info(this.context, MODULE_NAME, 'Getting all cases');
    return await this.caseManagement.getCases(this.context);
  }
}
