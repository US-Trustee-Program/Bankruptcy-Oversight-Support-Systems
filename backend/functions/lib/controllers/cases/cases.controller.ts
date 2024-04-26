import { ApplicationContext } from '../../adapters/types/basic';
import { CaseManagement } from '../../use-cases/case-management';
import { CaseListDbResult } from '../../adapters/types/cases';

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
    this.applicationContext.logger.info(MODULE_NAME, 'Getting all cases');
    return await this.caseManagement.getCases(this.applicationContext);
  }

  public async searchCases(requestQueryFilters: { caseNumber: string }): Promise<CaseListDbResult> {
    return this.caseManagement.getCasesByCaseNumberPartial(
      this.applicationContext,
      requestQueryFilters.caseNumber,
    );
  }
}
