import { CasesInterface } from '../../use-cases/cases.interface';
import { ApplicationContext } from '../types/basic';
import { Chapter15CaseInterface } from '../types/cases';
import { getCamsDateStringFromDate } from '../utils/date-helper';

export default class CasesDxtrGateway implements CasesInterface {
  getChapter15Cases(
    context: ApplicationContext,
    options: { startingMonth?: number },
  ): Promise<Chapter15CaseInterface[]> {
    const date = new Date();
    date.setMonth(date.getMonth() + (options.startingMonth || -6));
    const dateFiledFrom = getCamsDateStringFromDate(date);

    // TODO: find cases in DXTR
    const query = `select TOP 20 CS_DIV,
        CS_CASE_NUMBER,
        CS_SHORT_TITLE,
        CS_DATE_FILED
        FROM [dbo].[AO_CS]
        WHERE CS_CHAPTER = '15'
        AND CS_DATEFILED >= Convert(datetime, ${dateFiledFrom})`;

    console.log(query);

    return Promise.resolve([]);
  }
}
