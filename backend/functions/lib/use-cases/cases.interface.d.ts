import { CaseDetailInterface } from '../adapters/types/cases';
import { ApplicationContext } from '../adapters/types/basic';
import { CaseDocket } from './case-docket/case-docket.model';

export interface CasesInterface {
  getCaseDetail(
    applicationContext: ApplicationContext,
    caseId: string,
  ): Promise<CaseDetailInterface>;

  getCases(
    applicationContext: ApplicationContext,
    options: { startingMonth?: number },
  ): Promise<CaseDetailInterface[]>;
}

export interface CaseDocketInterface {
  getCaseDocket(applicationContext: ApplicationContext, caseId: string): Promise<CaseDocket>;
}
