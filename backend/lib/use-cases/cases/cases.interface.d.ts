import { ApplicationContext } from '../../adapters/types/basic';
import { CaseBasics, CaseDetail, CaseSummary } from '@common/cams/cases';
import { CasesSearchPredicate } from '@common/api/search';

export type CasesSyncMeta = {
  caseIds: string[];
  lastTxId: string;
};

type TransactionIdRangeForDate = {
  findDate: string;
  found: boolean;
  end?: number;
  start?: number;
};

export interface CasesInterface {
  getCaseDetail(applicationContext: ApplicationContext, caseId: string): Promise<CaseDetail>;

  searchCases(
    applicationContext: ApplicationContext,
    searchPredicate: CasesSearchPredicate,
  ): Promise<CaseBasics[]>;

  getCaseSummary(applicationContext: ApplicationContext, caseId: string): Promise<CaseSummary>;

  getSuggestedCases(applicationContext: ApplicationContext, caseId: string): Promise<CaseSummary[]>;

  getUpdatedCaseIds(
    applicationContext: ApplicationContext,
    start: string,
  ): Promise<{ caseIds: string[]; latestSyncDate: string }>;

  findTransactionIdRangeForDate(
    context: ApplicationContext,
    findDate: string,
  ): Promise<TransactionIdRangeForDate>;

  findMaxTransactionId(context: ApplicationContext): Promise<string>;
}
