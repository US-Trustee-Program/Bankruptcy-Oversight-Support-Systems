import { ApplicationContext } from '../types/basic';
import log from '../services/logger.service';
import { CaseManagement } from '../../use-cases/case-management';

const MODULE_NAME = 'CASES-CONTROLLER';

export class CasesController {
  private readonly applicationContext: ApplicationContext;
  private readonly caseManagement: CaseManagement;

  constructor(applicationContext: ApplicationContext) {
    this.applicationContext = applicationContext;
    this.caseManagement = new CaseManagement(this.applicationContext);
  }

  public async getCaseDetails(requestQueryFilters: { caseId: string }) {
    return this.caseManagement.getCaseDetail(this.applicationContext, requestQueryFilters.caseId);
  }

  public async getCases() {
    log.info(this.applicationContext, MODULE_NAME, 'Getting all cases');
    return await this.caseManagement.getCases(this.applicationContext);
  }
}
