import { CasesInterface } from '../../use-cases/cases.interface';
import { ApplicationContext } from '../types/basic';
import { Chapter15CaseInterface } from '../types/cases';
import { getCamsDateStringFromDate } from '../utils/date-helper';
import { executeQuery } from '../utils/database';
import { DbTableFieldSpec } from '../types/database';
import * as mssql from 'mssql';

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

    // TODO: find cases in DXTR
    const query = `select TOP 20 CS_DIV,
        CS_CASE_NUMBER,
        CS_SHORT_TITLE,
        CS_DATE_FILED
        FROM [dbo].[AO_CS]
        WHERE CS_CHAPTER = '15'
        AND CS_DATEFILED >= Convert(datetime, @dateFiledFrom)`;

    console.log(query);

    const bCases = await executeQuery(context, 'AODATEX_SUB', query, input);

    // TODO: convert bCases to Chapter15CaseInterface[]
    // bCases.results['recordset'].
    // get the recordset, and map `CS_DIV-CS_NUMBER` to `caseNumber`,
    //   `CS_SHORT_TITLE` to `caseTitle`, and `CS_DATE_FILED` to `dateFiled`

    console.log(bCases);
    return Promise.resolve([]);
  }
}
