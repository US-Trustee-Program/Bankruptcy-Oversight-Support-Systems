import { CasesInterface } from '../../../use-cases/cases.interface';
import { ApplicationContext } from '../../types/basic';
import {
  CaseDetailInterface,
  Party,
  DxtrTransactionRecord,
  TransactionDates,
} from '../../types/cases';
import {
  getMonthDayYearStringFromDate,
  getYearMonthDayStringFromDate,
  sortDates,
} from '../../utils/date-helper';
import { executeQuery } from '../../utils/database';
import { DbTableFieldSpec, QueryResults } from '../../types/database';
import * as mssql from 'mssql';
import log from '../../services/logger.service';
import { handleQueryResult } from '../gateway-helper';
import { parseTransactionDate } from './dxtr.gateway.helper';

const MODULENAME = 'CASES-DXTR-GATEWAY';

const MANHATTAN_GROUP_DESIGNATOR = 'NY';
const closedByCourtTxCode = 'CBC';
const dismissedByCourtTxCode = 'CDC';
const reopenedDate = 'OCO';

function sqlSelectList(top: string, chapter: string) {
  // THIS SETS US UP FOR SQL INJECTION IF WE EVER ACCEPT top OR chapter FROM USER INPUT.
  return `
    select TOP ${top}
    CS_DIV+'-'+CASE_ID as caseId,
    CS_SHORT_TITLE as caseTitle,
    CS_CHAPTER as chapter,
    FORMAT(CS_DATE_FILED, 'MM-dd-yyyy') as dateFiled
    FROM [dbo].[AO_CS]
    WHERE CS_CHAPTER = '${chapter}'
    AND GRP_DES = @groupDesignator
    AND CS_DATE_FILED >= Convert(datetime, @dateFiledFrom)
  `;
}
function sqlUnion(query1: string, query2: string) {
  return `${query1} UNION ALL ${query2}`;
}

export default class CasesDxtrGateway implements CasesInterface {
  async getCaseDetail(context: ApplicationContext, caseId: string): Promise<CaseDetailInterface> {
    const courtDiv = caseId.slice(0, 3);
    const dxtrCaseId = caseId.slice(4);

    const bCase = await this.queryCase(context, courtDiv, dxtrCaseId);

    const transactionDates = await this.queryTransactions(context, bCase.dxtrId, bCase.courtId);
    if (transactionDates.closedDates.length > 0) {
      bCase.closedDate = getMonthDayYearStringFromDate(transactionDates.closedDates[0]);
    }

    if (transactionDates.dismissedDates.length > 0) {
      bCase.dismissedDate = getMonthDayYearStringFromDate(transactionDates.dismissedDates[0]);
    }

    if (transactionDates.reopenedDates.length > 0) {
      bCase.reopenedDate = getMonthDayYearStringFromDate(transactionDates.reopenedDates[0]);
    }

    bCase.debtor = await this.queryParties(context, bCase.dxtrId, bCase.courtId);

    return bCase;
  }

  async getCases(
    context: ApplicationContext,
    options: { startingMonth?: number },
  ): Promise<CaseDetailInterface[]> {
    const doChapter12Enable = context.featureFlags['chapter-twelve-enabled'];
    const rowsToReturn = doChapter12Enable ? '10' : '20';

    const input: DbTableFieldSpec[] = [];
    const date = new Date();
    date.setMonth(date.getMonth() + (options.startingMonth || -6));
    const dateFiledFrom = getYearMonthDayStringFromDate(date);
    input.push({
      name: 'top',
      type: mssql.Int,
      value: rowsToReturn,
    });
    input.push({
      name: 'dateFiledFrom',
      type: mssql.Date,
      value: dateFiledFrom,
    });
    input.push({
      name: 'groupDesignator',
      type: mssql.Char,
      value: MANHATTAN_GROUP_DESIGNATOR,
    });
    const query = doChapter12Enable
      ? sqlUnion(sqlSelectList(rowsToReturn, '15'), sqlSelectList(rowsToReturn, '12'))
      : sqlSelectList(rowsToReturn, '15');

    const queryResult: QueryResults = await executeQuery(
      context,
      context.config.dxtrDbConfig,
      query,
      input,
    );

    return Promise.resolve(
      handleQueryResult<CaseDetailInterface[]>(
        context,
        queryResult,
        MODULENAME,
        this.casesQueryCallback,
      ),
    );
  }

  private async queryCase(
    context: ApplicationContext,
    courtDiv: string,
    dxtrCaseId: string,
  ): Promise<CaseDetailInterface> {
    const input: DbTableFieldSpec[] = [];

    input.push({
      name: 'courtDiv',
      type: mssql.VarChar,
      value: courtDiv,
    });

    input.push({
      name: 'dxtrCaseId',
      type: mssql.VarChar,
      value: dxtrCaseId,
    });

    const CASE_DETAIL_QUERY = `select
        CS_DIV+'-'+CASE_ID as caseId,
        CS_SHORT_TITLE as caseTitle,
        FORMAT(CS_DATE_FILED, 'MM-dd-yyyy') as dateFiled,
        CS_CASEID as dxtrId,
        CS_CHAPTER as chapter,
        COURT_ID as courtId,
        TRIM(CONCAT(JD_FIRST_NAME, ' ', JD_MIDDLE_NAME, ' ', JD_LAST_NAME)) as judgeName
        FROM [dbo].[AO_CS]
        WHERE CASE_ID = @dxtrCaseId
        AND CS_DIV = @courtDiv`;

    const queryResult: QueryResults = await executeQuery(
      context,
      context.config.dxtrDbConfig,
      CASE_DETAIL_QUERY,
      input,
    );

    return Promise.resolve(
      handleQueryResult<CaseDetailInterface>(
        context,
        queryResult,
        MODULENAME,
        this.caseDetailsQueryCallback,
      ),
    );
  }

  private async queryTransactions(
    context: ApplicationContext,
    dxtrId: string,
    courtId: string,
  ): Promise<TransactionDates> {
    const input: DbTableFieldSpec[] = [];

    input.push({
      name: 'dxtrId',
      type: mssql.VarChar,
      value: dxtrId,
    });

    input.push({
      name: 'courtId',
      type: mssql.VarChar,
      value: courtId,
    });

    input.push({
      name: 'closedByCourtTxCode',
      type: mssql.VarChar,
      value: closedByCourtTxCode,
    });

    input.push({
      name: 'dismissedByCourtTxCode',
      type: mssql.VarChar,
      value: dismissedByCourtTxCode,
    });

    input.push({
      name: 'reopenedDate',
      type: mssql.VarChar,
      value: reopenedDate,
    });

    const query = `select
      REC as txRecord,
      TX_CODE as txCode
      FROM [dbo].[AO_TX]
      WHERE CS_CASEID = @dxtrId
      AND COURT_ID = @courtId
      AND TX_CODE in (@closedByCourtTxCode, @dismissedByCourtTxCode, @reopenedDate)`;

    const queryResult: QueryResults = await executeQuery(
      context,
      context.config.dxtrDbConfig,
      query,
      input,
    );

    return Promise.resolve(
      handleQueryResult<TransactionDates>(
        context,
        queryResult,
        MODULENAME,
        this.transactionQueryCallback,
      ),
    );
  }

  private async queryParties(
    context: ApplicationContext,
    dxtrId: string,
    courtId: string,
  ): Promise<Party> {
    const debtorPartyCode = 'db';
    const input: DbTableFieldSpec[] = [];

    input.push({
      name: 'dxtrId',
      type: mssql.VarChar,
      value: dxtrId,
    });

    input.push({
      name: 'courtId',
      type: mssql.VarChar,
      value: courtId,
    });

    input.push({
      name: 'debtorPartyCode',
      type: mssql.VarChar,
      value: debtorPartyCode,
    });

    const query = `SELECT
        TRIM(CONCAT(
          PY_FIRST_NAME,
          ' ',
          PY_MIDDLE_NAME,
          ' ',
          PY_LAST_NAME,
          ' ',
          PY_GENERATION
        )) as name,
        PY_ADDRESS1 as address1,
        PY_ADDRESS2 as address2,
        PY_ADDRESS3 as address3,
        TRIM(CONCAT(
          PY_CITY,
          ' ',
          PY_STATE,
          ' ',
          PY_ZIP,
          ' ',
          PY_COUNTRY
        )) as address4
      FROM [dbo].[AO_PY]
      WHERE
        CS_CASEID = @dxtrId AND
        COURT_ID = @courtId AND
        PY_ROLE = @debtorPartyCode
    `;

    const queryResult: QueryResults = await executeQuery(
      context,
      context.config.dxtrDbConfig,
      query,
      input,
    );

    return Promise.resolve(
      handleQueryResult<Party>(context, queryResult, MODULENAME, this.partyQueryCallback),
    );
  }

  partyQueryCallback(context: ApplicationContext, queryResult: QueryResults) {
    let debtor: Party;
    log.debug(context, MODULENAME, `Party results received from DXTR:`, queryResult);

    (queryResult.results as mssql.IResult<Party>).recordset.forEach((record) => {
      debtor = { name: record.name };
      debtor.address1 = record.address1;
      debtor.address2 = record.address2;
      debtor.address3 = record.address3;
      debtor.address4 = record.address4?.replace(new RegExp(/\s+/), ' ');
    });
    return debtor || null;
  }

  transactionQueryCallback(context: ApplicationContext, queryResult: QueryResults) {
    const closedDates: Date[] = [];
    const dismissedDates: Date[] = [];
    const reopenedDates: Date[] = [];
    log.debug(context, MODULENAME, `Transaction results received from DXTR:`, queryResult);
    (queryResult.results as mssql.IResult<DxtrTransactionRecord>).recordset.forEach((record) => {
      const transactionDate = parseTransactionDate(record);

      if (record.txCode === closedByCourtTxCode) {
        closedDates.push(transactionDate);
      } else if (record.txCode === dismissedByCourtTxCode) {
        dismissedDates.push(transactionDate);
      } else {
        reopenedDates.push(transactionDate);
      }
    });

    sortDates(closedDates);
    sortDates(dismissedDates);
    sortDates(reopenedDates);

    return { closedDates, dismissedDates, reopenedDates } as TransactionDates;
  }

  caseDetailsQueryCallback(context: ApplicationContext, queryResult: QueryResults) {
    log.debug(context, MODULENAME, `Case results received from DXTR:`, queryResult);

    return (queryResult.results as mssql.IResult<CaseDetailInterface>).recordset[0];
  }

  casesQueryCallback(context: ApplicationContext, queryResult: QueryResults) {
    log.debug(context, MODULENAME, `Results received from DXTR `, queryResult);

    return (queryResult.results as mssql.IResult<CaseDetailInterface[]>).recordset;
  }
}
