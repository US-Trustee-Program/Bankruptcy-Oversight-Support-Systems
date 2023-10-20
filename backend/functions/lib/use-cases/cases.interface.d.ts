import { CaseDetailInterface } from '../adapters/types/cases';
import { ApplicationContext } from '../adapters/types/basic';

export interface CasesInterface {
  getChapter15Cases(
    context: ApplicationContext,
    options: { startingMonth?: number },
  ): Promise<CaseDetailInterface[]>;

  getChapter15Case(context: ApplicationContext, caseId: string): Promise<CaseDetailInterface>;

  getCases(
    context: ApplicationContext,
    options: { startingMonth?: number },
  ): Promise<CaseDetailInterface[]>;
}
