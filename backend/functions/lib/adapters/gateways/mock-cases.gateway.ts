import { CasesInterface } from '../../use-cases/cases.interface';
import { CaseDetailInterface } from '../types/cases';
import { Context } from '@azure/functions';
import { getYearMonthDayStringFromDate } from '../utils/date-helper';
import { ApplicationContext } from '../types/basic';

export class MockCasesGateway implements CasesInterface {
  startingMonth: number;
  private chapter15CaseList: CaseDetailInterface[] = [];

  constructor() {
    this.setUpChapter15TestCaseList();
    this.startingMonth = -6;
  }

  async getChapter15Cases(
    context: Context,
    options: { startingMonth?: number },
  ): Promise<CaseDetailInterface[]> {
    if (options.startingMonth != undefined) {
      this.startingMonth = options.startingMonth;
    }
    const startDate = this.subtractMonths(new Date());

    const filteredCases = this.chapter15CaseList.filter(
      (chapter15case) => chapter15case.dateFiled.toString() >= startDate.toISOString(),
    );

    return Promise.resolve(filteredCases);
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async getChapter15Case(context: Context, caseId: string): Promise<CaseDetailInterface> {
    // const bCase = this.chapter15CaseList.filter((aCase) => )
    throw new Error('not implemented');
  }

  private subtractMonths(date) {
    date.setMonth(date.getMonth() + this.startingMonth);
    return date;
  }

  private setUpChapter15TestCaseList() {
    //Add Cases older than 6 months
    const oldCases: CaseDetailInterface[] = [];
    const today = new Date();

    oldCases.push(
      {
        caseId: '081-19-44449',
        caseTitle: 'Flo Esterly and Neas Van Sampson',
        chapter: '15',
        dateFiled: getYearMonthDayStringFromDate(
          new Date(today.getFullYear() - 4, today.getMonth() - 10, today.getDate()),
        ),
        assignments: [],
      },
      {
        caseId: '081-23-01122',
        caseTitle: 'Jennifer Millhouse',
        chapter: '15',
        dateFiled: getYearMonthDayStringFromDate(
          new Date(today.getFullYear(), today.getMonth() - 7, today.getDate()),
        ),
        assignments: ['Mr. Jones', 'Diana', 'Joe'],
      },
      {
        caseId: '081-13-01166',
        caseTitle: 'Heather Anne Real',
        chapter: '15',
        dateFiled: getYearMonthDayStringFromDate(
          new Date(today.getFullYear() - 10, today.getMonth(), today.getDate()),
        ),
        assignments: [],
      },
    );
    this.chapter15CaseList.push(...oldCases);

    // Add Cases newer than 6 months
    const newCases: CaseDetailInterface[] = [];

    newCases.push(
      {
        caseId: '081-23-01167',
        caseTitle: 'Heather Anne Real',
        chapter: '15',
        dateFiled: getYearMonthDayStringFromDate(
          new Date(today.getFullYear(), today.getMonth() - 1, today.getDate()),
        ),
        assignments: [],
      },
      {
        caseId: '081-23-01175',
        caseTitle: 'James P. Tennor',
        chapter: '15',
        dateFiled: getYearMonthDayStringFromDate(
          new Date(today.getFullYear(), today.getMonth() - 3, today.getDate()),
        ),
        assignments: ['Daisy', 'Roger', 'Frank'],
      },
      {
        caseId: '081-23-01176',
        caseTitle: 'Tommy Testformiddlena tennor',
        chapter: '15',
        dateFiled: getYearMonthDayStringFromDate(
          new Date(today.getFullYear(), today.getMonth() - 2, today.getDate()),
        ),
        assignments: [],
      },
    );
    this.chapter15CaseList.push(...newCases);
  }

  async getCases(
    context: ApplicationContext,
    options: { startingMonth?: number },
  ): Promise<CaseDetailInterface[]> {
    console.debug('getCases invoked', context, options);
    throw new Error('Not yet implemented');
  }
}
