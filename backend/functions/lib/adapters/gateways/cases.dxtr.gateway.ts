import { CasesInterface } from '../../use-cases/cases.interface';
import { ApplicationContext } from '../types/basic';
import { Chapter15CaseInterface, DxtrTransactionRecord } from '../types/cases';
import {
  getDate,
  getMonthDayYearStringFromDate,
  getYearMonthDayStringFromDate,
} from '../utils/date-helper';
import { executeQuery } from '../utils/database';
import { DbTableFieldSpec, QueryResults } from '../types/database';
import * as mssql from 'mssql';
import log from '../services/logger.service';

const MODULENAME = 'CASES-DXTR-GATEWAY';

const MANHATTAN_GROUP_DESIGNATOR = 'NY';

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
  async getChapter15Cases(
    context: ApplicationContext,
    options: { startingMonth?: number },
  ): Promise<Chapter15CaseInterface[]> {
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

    if (queryResult.success) {
      log.debug(context, MODULENAME, `Results received from DXTR `, queryResult);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (queryResult.results as mssql.IResult<any>).recordset;
    } else {
      throw Error(queryResult.message);
    }
  }

  async getChapter15Case(
    context: ApplicationContext,
    caseId: string,
  ): Promise<Chapter15CaseInterface> {
    const courtDiv = caseId.slice(0, 3);
    const dxtrCaseId = caseId.slice(4);

    const bCase = await this.queryCases(context, courtDiv, dxtrCaseId);

    const { closedDates, dismissedDates } = await this.queryTransactions(
      context,
      bCase.dxtrId,
      bCase.courtId,
    );
    if (closedDates.length > 0) {
      bCase.closedDate = getMonthDayYearStringFromDate(closedDates[0]);
    }

    if (dismissedDates.length > 0) {
      bCase.dismissedDate = getMonthDayYearStringFromDate(closedDates[0]);
    }

    return bCase;
  }

  private async queryCases(
    context: ApplicationContext,
    courtDiv: string,
    dxtrCaseId: string,
  ): Promise<Chapter15CaseInterface> {
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

    const query = `select
        CS_DIV+'-'+CASE_ID as caseId,
        CS_SHORT_TITLE as caseTitle,
        FORMAT(CS_DATE_FILED, 'MM-dd-yyyy') as dateFiled,
        CS_CASEID as dxtrId,
        CS_CHAPTER as chapter,
        COURT_ID as courtId
        FROM [dbo].[AO_CS]
        WHERE CASE_ID = @dxtrCaseId
        AND CS_DIV = @courtDiv`;

    const queryResult: QueryResults = await executeQuery(
      context,
      context.config.dxtrDbConfig,
      query,
      input,
    );

    if (queryResult.success) {
      log.debug(context, MODULENAME, `Case results received from DXTR:`, queryResult);

      return (queryResult.results as mssql.IResult<Chapter15CaseInterface>).recordset[0];
    } else {
      throw Error(queryResult.message);
    }
  }

  private async queryTransactions(
    context: ApplicationContext,
    dxtrId: string,
    courtId: string,
  ): Promise<{ closedDates: Date[]; dismissedDates: Date[] }> {
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

    const closedByCourtTxCode = 'CBC';

    input.push({
      name: 'closedByCourtTxCode',
      type: mssql.VarChar,
      value: closedByCourtTxCode,
    });

    const dismissedByCourtTxCode = 'CDC';

    input.push({
      name: 'dismissedByCourtTxCode',
      type: mssql.VarChar,
      value: dismissedByCourtTxCode,
    });

    const query = `select
      REC as txRecord,
      TX_CODE as txCode
      FROM [dbo].[AO_TX]
      WHERE CS_CASEID = @dxtrId
      AND COURT_ID = @courtId
      AND TX_CODE in (@closedByCourtTxCode, @dismissedByCourtTxCode)`;

    const queryResult: QueryResults = await executeQuery(
      context,
      context.config.dxtrDbConfig,
      query,
      input,
    );

    const closedDates: Date[] = [];
    const dismissedDates: Date[] = [];

    function parseTransactionDate(record: DxtrTransactionRecord): Date {
      const transactionYearStart = 19;
      const transactionDateYear = record.txRecord.slice(
        transactionYearStart,
        transactionYearStart + 2,
      );

      const transactionMonthStart = 21;
      const transactionDateMonth = record.txRecord.slice(
        transactionMonthStart,
        transactionMonthStart + 2,
      );

      const transactionDayStart = 23;
      const transactionDateDay = record.txRecord.slice(
        transactionDayStart,
        transactionDayStart + 2,
      );

      // `new Date()` uses a base year of 1900, so we add 2000 to the 2-digit year
      const baseYear = 2000;
      return getDate(
        parseInt(transactionDateYear) + baseYear,
        parseInt(transactionDateMonth),
        parseInt(transactionDateDay),
      );
    }

    if (queryResult.success) {
      log.debug(context, MODULENAME, `Transaction results received from DXTR:`, queryResult);
      (queryResult.results as mssql.IResult<DxtrTransactionRecord>).recordset.forEach((record) => {
        const transactionDate = parseTransactionDate(record);

        if (record.txCode === closedByCourtTxCode) {
          closedDates.push(transactionDate);
        } else {
          dismissedDates.push(transactionDate);
        }
      });

      closedDates.sort((a: Date, b: Date) => {
        // sort in order of newest to oldest
        return b.valueOf() - a.valueOf();
      });

      dismissedDates.sort((a: Date, b: Date) => {
        // sort in order of newest to oldest
        return b.valueOf() - a.valueOf();
      });

      return { closedDates, dismissedDates };
    } else {
      throw Error(queryResult.message);
    }
  }
}
