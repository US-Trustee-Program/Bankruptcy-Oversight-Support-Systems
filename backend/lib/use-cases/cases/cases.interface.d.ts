import { CasesSearchPredicate } from '../../../../common/src/api/search';
import { CaseBasics, CaseDetail, CaseSummary } from '../../../../common/src/cams/cases';
import { ApplicationContext } from '../../adapters/types/basic';

export interface CasesInterface {
  findMaxTransactionId(context: ApplicationContext): Promise<string>;

  findTransactionIdRangeForDate(
    context: ApplicationContext,
    findDate: string,
  ): Promise<TransactionIdRangeForDate>;

  getCaseDetail(applicationContext: ApplicationContext, caseId: string): Promise<CaseDetail>;

  getCaseSummary(applicationContext: ApplicationContext, caseId: string): Promise<CaseSummary>;

  getSuggestedCases(applicationContext: ApplicationContext, caseId: string): Promise<CaseSummary[]>;

  getUpdatedCaseIds(applicationContext: ApplicationContext, start: string): Promise<string[]>;

  searchCases(
    applicationContext: ApplicationContext,
    searchPredicate: CasesSearchPredicate,
  ): Promise<CaseBasics[]>;
}

export type CasesSyncMeta = {
  caseIds: string[];
  lastTxId: string;
};

type TransactionIdRangeForDate = {
  end?: number;
  findDate: string;
  found: boolean;
  start?: number;
};
