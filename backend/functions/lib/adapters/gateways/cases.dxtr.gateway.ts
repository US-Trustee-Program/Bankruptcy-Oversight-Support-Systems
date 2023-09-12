import { CasesInterface } from '../../use-cases/cases.interface';
import { ApplicationContext } from '../types/basic';
import { Chapter15CaseInterface } from '../types/cases';
import { getCamsDateStringFromDate } from '../utils/date-helper';
import { executeQuery } from '../utils/database';
import { DbTableFieldSpec, QueryResults } from '../types/database';
import * as mssql from 'mssql';
import log from '../services/logger.service';

const MODULENAME = 'CASES-DXTR-GATEWAY';

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
    const MANHATTAN_GROUP_DESIGNATOR = 'NY';
    const query = `select TOP 20
        CASE_ID as caseNumber,
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
      log.debug(context, MODULENAME, `Results received from DXTR ${queryResult}`);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (queryResult.results as mssql.IResult<any>).recordset;
    } else {
      throw Error(queryResult.message);
    }
  }
}
