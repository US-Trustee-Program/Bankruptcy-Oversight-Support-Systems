import { CaseDetailInterface } from '../adapters/types/cases';
import { ApplicationContext } from '../adapters/types/basic';

export interface CasesInterface {
  getCaseDetail(context: ApplicationContext, caseId: string): Promise<CaseDetailInterface>;

  getCases(
    context: ApplicationContext,
    options: { startingMonth?: number },
  ): Promise<CaseDetailInterface[]>;
}
