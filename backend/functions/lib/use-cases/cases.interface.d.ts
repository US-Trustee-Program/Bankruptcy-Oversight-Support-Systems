import { CaseDetail } from '../adapters/types/cases';
import { ApplicationContext } from '../adapters/types/basic';

export interface CasesInterface {
  getCaseDetail(applicationContext: ApplicationContext, caseId: string): Promise<CaseDetail>;

  getCases(
    applicationContext: ApplicationContext,
    options: { startingMonth?: number },
  ): Promise<CaseDetail[]>;

  getCaseSummary(applicationContext: ApplicationContext, caseId: string): Promise<CaseDetail>;

  getSuggestedCases(applicationContext: ApplicationContext, caseId: string): Promise<CaseDetail[]>;
}
