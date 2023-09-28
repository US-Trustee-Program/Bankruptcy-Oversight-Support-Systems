import { CasesInterface } from '../../use-cases/cases.interface';
import { Chapter15CaseInterface } from '../types/cases';
import { Context } from '@azure/functions';
import { getCamsDateStringFromDate } from '../utils/date-helper';

export class MockCasesGateway implements CasesInterface {
  startingMonth: number;
  private chapter15CaseList: Chapter15CaseInterface[] = [];

  constructor() {
    this.setUpChapter15TestCaseList();
    this.startingMonth = -6;
  }

  async getChapter15Cases(
    context: Context,
    options: { startingMonth?: number },
  ): Promise<Chapter15CaseInterface[]> {
    if (options.startingMonth != undefined) {
      this.startingMonth = options.startingMonth;
    }
    const startDate = this.subtractMonths(new Date());

    const filteredCases = this.chapter15CaseList.filter(
      (chapter15case) => chapter15case.dateFiled.toString() >= startDate.toISOString(),
    );

    return Promise.resolve(filteredCases);
  }

  private subtractMonths(date) {
    date.setMonth(date.getMonth() + this.startingMonth);
    return date;
  }

  private setUpChapter15TestCaseList() {
    //Add Cases older than 6 months
    const oldCases: Chapter15CaseInterface[] = [];
    const today = new Date();

    oldCases.push(
      {
        caseId: '44449',
        caseNumber: '44449',
        caseTitle: 'Flo Esterly and Neas Van Sampson',
        dateFiled: getCamsDateStringFromDate(
          new Date(today.getFullYear() - 4, today.getMonth() - 10, today.getDate()),
        ),
        assignments: [],
      },
      {
        caseId: '1122',
        caseNumber: '1122',
        caseTitle: 'Jennifer Millhouse',
        dateFiled: getCamsDateStringFromDate(
          new Date(today.getFullYear(), today.getMonth() - 7, today.getDate()),
        ),
        assignments: ['Mr. Jones', 'Diana', 'Joe'],
      },
      {
        caseId: '1166',
        caseNumber: '1166',
        caseTitle: 'Heather Anne Real',
        dateFiled: getCamsDateStringFromDate(
          new Date(today.getFullYear() - 10, today.getMonth(), today.getDate()),
        ),
        assignments: [],
      },
    );
    this.chapter15CaseList.push(...oldCases);

    // Add Cases newer than 6 months
    const newCases: Chapter15CaseInterface[] = [];

    newCases.push(
      {
        caseId: '1167',
        caseNumber: '1167',
        caseTitle: 'Heather Anne Real',
        dateFiled: getCamsDateStringFromDate(
          new Date(today.getFullYear(), today.getMonth() - 1, today.getDate()),
        ),
        assignments: [],
      },
      {
        caseId: '1175',
        caseNumber: '1175',
        caseTitle: 'James P. Tennor',
        dateFiled: getCamsDateStringFromDate(
          new Date(today.getFullYear(), today.getMonth() - 3, today.getDate()),
        ),
        assignments: ['Daisy', 'Roger', 'Frank'],
      },
      {
        caseId: '1176',
        caseNumber: '1176',
        caseTitle: 'Tommy Testformiddlena tennor',
        dateFiled: getCamsDateStringFromDate(
          new Date(today.getFullYear(), today.getMonth() - 2, today.getDate()),
        ),
        assignments: [],
      },
    );
    this.chapter15CaseList.push(...newCases);
  }
}
