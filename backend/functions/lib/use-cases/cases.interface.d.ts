import { CaseDetailInterface } from '../adapters/types/cases';
import { ApplicationContext } from '../adapters/types/basic';

export interface CasesInterface {
  getCaseDetail(
    applicationContext: ApplicationContext,
    caseId: string,
  ): Promise<CaseDetailInterface>;

  getCases(
    applicationContext: ApplicationContext,
    options: { startingMonth?: number },
  ): Promise<CaseDetailInterface[]>;

  getCaseSummary(
    applicationContext: ApplicationContext,
    caseId: string,
  ): Promise<CaseDetailInterface>;

  getSuggestedCases(
    applicationContext: ApplicationContext,
    caseId: string,
  ): Promise<CaseDetailInterface[]>;
}
