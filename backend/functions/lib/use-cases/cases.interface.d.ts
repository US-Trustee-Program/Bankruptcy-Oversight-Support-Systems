import { ApplicationContext } from '../adapters/types/basic';
import { CaseDetail, CaseSummary } from '../../../../common/src/cams/cases';

export interface CasesInterface {
  getCaseDetail(applicationContext: ApplicationContext, caseId: string): Promise<CaseDetail>;

  // TODO: this should return something other than CaseDetail[], with even fewer props than CaseSummary
  getCases(
    applicationContext: ApplicationContext,
    options: { startingMonth?: number },
  ): Promise<CaseDetail[]>;

  getCasesByCaseNumberPartial(
    applicationContext: ApplicationContext,
    caseId: string,
  ): Promise<CaseSummary[]>;

  getCaseSummary(applicationContext: ApplicationContext, caseId: string): Promise<CaseSummary>;

  getSuggestedCases(applicationContext: ApplicationContext, caseId: string): Promise<CaseSummary[]>;
}
