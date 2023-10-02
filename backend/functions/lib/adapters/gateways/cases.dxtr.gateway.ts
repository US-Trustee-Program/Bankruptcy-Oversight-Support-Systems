import { CasesInterface } from '../../use-cases/cases.interface';
import { ApplicationContext } from '../types/basic';
import { Chapter15CaseInterface } from '../types/cases';
import { getCamsDateStringFromDate } from '../utils/date-helper';
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
    const dateFiledFrom = getCamsDateStringFromDate(date);
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
    const input: DbTableFieldSpec[] = [];

    const courtDiv = caseId.slice(0, 3);
    const dxtrCaseId = caseId.slice(4);

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
        FORMAT(CS_DATE_FILED, 'MM-dd-yyyy') as dateFiled
        FROM [dbo].[AO_CS]
        WHERE CS_CHAPTER = '15'
        AND CASE_ID = @dxtrCaseId
        AND CS_DIV = @courtDiv
        AND GRP_DES = '${MANHATTAN_GROUP_DESIGNATOR}'`;

    //    FORMAT(CS_DATE_CLOSED, 'MM-dd-yyyy') as dateClosed
    const queryResult: QueryResults = await executeQuery(
      context,
      context.config.dxtrDbConfig,
      query,
      input,
    );

    if (queryResult.success) {
      log.debug(context, MODULENAME, `Results received from DXTR `, queryResult);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (queryResult.results as mssql.IResult<any>).recordset[0];
    } else {
      throw Error(queryResult.message);
    }
  }
}
