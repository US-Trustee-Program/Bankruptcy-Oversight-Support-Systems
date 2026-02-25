import { ApplicationContext } from '../../adapters/types/basic';
import { CaseBasics, CaseDetail, CaseSummary } from '@common/cams/cases';
import { CasesSearchPredicate } from '@common/api/search';
import { TrusteeAppointmentSyncEvent } from '@common/cams/dataflow-events';

export type UpdatedCaseIds = {
  caseIds: string[];
  latestCasesSyncDate: string;
  latestTransactionsSyncDate: string;
};

export type TrusteeAppointmentsResult = {
  events: TrusteeAppointmentSyncEvent[];
  latestSyncDate: string;
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
    casesStart: string,
    transactionsStart: string,
  ): Promise<UpdatedCaseIds>;

  getCasesWithTerminalTransactionBlindSpot(
    context: ApplicationContext,
    cutoffDate: string,
  ): Promise<string[]>;

  findTransactionIdRangeForDate(
    context: ApplicationContext,
    findDate: string,
  ): Promise<TransactionIdRangeForDate>;

  findMaxTransactionId(context: ApplicationContext): Promise<string>;

  getTrusteeAppointments(
    context: ApplicationContext,
    transactionsStart: string,
  ): Promise<TrusteeAppointmentsResult>;
}
