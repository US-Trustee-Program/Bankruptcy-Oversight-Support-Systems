import { ApplicationContext } from '../../adapters/types/basic';
import { CaseBasics, CaseDetail, CaseSummary } from '@common/cams/cases';
import { CasesSearchPredicate } from '@common/api/search';
import { TrusteeAppointmentSyncEvent } from '@common/cams/dataflow-events';

export type UpdatedCaseIds = {
  caseIds: string[];
  latestCasesSyncDate: string;
  latestTransactionsSyncDate: string;
};

/** One region's trustee appointment transactions for one TX_DATE day, after afterTxId. */
export type TrusteeAppointmentEventsPageRequest = {
  regionId: string;
  /** ISO date (YYYY-MM-DD); only transactions whose TX_DATE falls on this day are read. */
  txDate: string;
  /** Read transactions with a TX_ID greater than this ('0' for the first page). */
  afterTxId: string;
  limit: number;
};

export type TrusteeAppointmentEventsPage = {
  events: TrusteeAppointmentSyncEvent[];
  /** Greatest TX_ID on the page; absent when the page is empty. */
  lastTxId?: string;
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
    end?: string,
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

  getLatestTrusteeAppointmentTxDateForRegion(
    context: ApplicationContext,
    regionId: string,
  ): Promise<string | undefined>;

  getTrusteeAppointmentEventsForRegionDate(
    context: ApplicationContext,
    request: TrusteeAppointmentEventsPageRequest,
  ): Promise<TrusteeAppointmentEventsPage>;

  getAppointmentDatesByCaseIds(
    context: ApplicationContext,
    caseIds: string[],
  ): Promise<Map<string, string>>;
}
