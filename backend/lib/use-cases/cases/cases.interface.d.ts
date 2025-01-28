import { ApplicationContext } from '../../adapters/types/basic';
import { CaseBasics, CaseDetail, CaseSummary } from '../../../../common/src/cams/cases';
import { CasesSearchPredicate } from '../../../../common/src/api/search';

export type CasesSyncMeta = {
  caseIds: string[];
  lastTxId: string;
};

export interface CasesInterface {
  getCaseDetail(applicationContext: ApplicationContext, caseId: string): Promise<CaseDetail>;

  searchCases(
    applicationContext: ApplicationContext,
    searchPredicate: CasesSearchPredicate,
  ): Promise<CaseBasics[]>;

  getCaseSummary(applicationContext: ApplicationContext, caseId: string): Promise<CaseSummary>;

  getSuggestedCases(applicationContext: ApplicationContext, caseId: string): Promise<CaseSummary[]>;

  getCaseIdsAndMaxTxIdToSync(
    applicationContext: ApplicationContext,
    lastTxId: string,
  ): Promise<CasesSyncMeta>;
}
