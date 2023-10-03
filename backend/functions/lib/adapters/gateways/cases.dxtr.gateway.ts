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

export default class CasesDxtrGateway implements CasesInterface {
  async getChapter15Cases(
    context: ApplicationContext,
    options: { startingMonth?: number },
  ): Promise<Chapter15CaseInterface[]> {
    const input: DbTableFieldSpec[] = [];
    const date = new Date();
    date.setMonth(date.getMonth() + (options.startingMonth || -6));
    const dateFiledFrom = getYearMonthDayStringFromDate(date);
    input.push({
      name: 'dateFiledFrom',
      type: mssql.Date,
      value: dateFiledFrom,
    });
    const query = `select TOP 20
        CS_DIV+'-'+CASE_ID as caseId,
        CS_SHORT_TITLE as caseTitle,
        FORMAT(CS_DATE_FILED, 'MM-dd-yyyy') as dateFiled
        FROM [dbo].[AO_CS]
        WHERE CS_CHAPTER = '15'
        AND GRP_DES = '${MANHATTAN_GROUP_DESIGNATOR}'
        AND CS_DATE_FILED >= Convert(datetime, @dateFiledFrom)`;

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

    const closedDates = await this.queryTransactions(context, bCase.dxtrId, bCase.courtId);
    if (closedDates.length > 0) {
      bCase.closedDate = getMonthDayYearStringFromDate(closedDates[0]);
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
  ): Promise<Date[]> {
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

    const query = `select
        REC as txRecord
        FROM [dbo].[AO_TX]
        WHERE CS_CASEID = @dxtrId
        AND COURT_ID = @courtId
        AND TX_CODE = ${closedByCourtTxCode}`;

    const queryResult: QueryResults = await executeQuery(
      context,
      context.config.dxtrDbConfig,
      query,
      input,
    );

    const closedDates = [];
    if (queryResult.success) {
      log.debug(context, MODULENAME, `Transaction results received from DXTR:`, queryResult);
      (queryResult.results as mssql.IResult<DxtrTransactionRecord>).recordset.forEach((record) => {
        const transactionYearStart = 19;
        const closedDateYear = record.txRecord.slice(
          transactionYearStart,
          transactionYearStart + 2,
        );

        const transactionMonthStart = 21;
        const closedDateMonth = record.txRecord.slice(
          transactionMonthStart,
          transactionMonthStart + 2,
        );

        const transactionDayStart = 23;
        const closedDateDay = record.txRecord.slice(transactionDayStart, transactionDayStart + 2);

        // `new Date()` uses a base year of 1900, so we add 2000 to the 2-digit year
        const baseYear = 2000;

        closedDates.push(
          getDate(
            parseInt(closedDateYear) + baseYear,
            parseInt(closedDateMonth),
            parseInt(closedDateDay),
          ),
        );
      });

      closedDates.sort((a: Date, b: Date) => {
        // sort in order of newest to oldest
        return b.valueOf() - a.valueOf();
      });

      return closedDates;
    } else {
      throw Error(queryResult.message);
    }
  }
}
