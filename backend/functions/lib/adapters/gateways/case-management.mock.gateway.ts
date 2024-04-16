import { CasesInterface } from '../../use-cases/cases.interface';
import { CaseDetail } from '../../../../../common/src/cams/cases';
import { getYearMonthDayStringFromDate } from '../utils/date-helper';
import { ApplicationContext } from '../types/basic';

export class MockCasesGateway implements CasesInterface {
  startingMonth: number;
  private caseList: CaseDetail[] = [];

  constructor() {
    this.setUpTestCaseList();
    this.startingMonth = -6;
  }

  async getCases(
    _applicationContext: ApplicationContext,
    options: { startingMonth?: number },
  ): Promise<CaseDetail[]> {
    if (options.startingMonth != undefined) {
      this.startingMonth = options.startingMonth;
    }
    const startDate = this.subtractMonths(new Date());

    const filteredCases = this.caseList.filter(
      (bCase) => bCase.dateFiled.toString() >= startDate.toISOString(),
    );

    return Promise.resolve(filteredCases);
  }

  async getCaseDetail(
    _applicationContext: ApplicationContext,
    _caseId: string,
  ): Promise<CaseDetail> {
    // const bCase = this.caseList.filter((aCase) => )
    throw new Error('not implemented');
  }

  async getCaseSummary(
    _applicationContext: ApplicationContext,
    _caseId: string,
  ): Promise<CaseDetail> {
    // const bCase = this.caseList.filter((aCase) => )
    throw new Error('not implemented');
  }

  public async getSuggestedCases(
    _applicationContext: ApplicationContext,
    _caseId: string,
  ): Promise<CaseDetail[]> {
    throw new Error('not implemented');
  }

  private subtractMonths(date) {
    date.setMonth(date.getMonth() + this.startingMonth);
    return date;
  }

  private setUpTestCaseList() {
    //Add Cases older than 6 months
    const oldCases: CaseDetail[] = [];
    const today = new Date();

    oldCases.push(
      {
        caseId: '081-19-44449',
        caseTitle: 'Flo Esterly and Neas Van Sampson',
        chapter: '15',
        courtDivisionCode: '081',
        dateFiled: getYearMonthDayStringFromDate(
          new Date(today.getFullYear() - 4, today.getMonth() - 10, today.getDate()),
        ),
        assignments: [],
        courtId: '',
        courtDivisionName: '',
        courtName: '',
        dxtrId: '0',
        groupDesignator: '',
        officeCode: '',
        officeName: '',
        regionId: '',
        regionName: '',
        debtor: {
          name: 'DebtorName',
        },
      },
      {
        caseId: '081-23-01122',
        caseTitle: 'Jennifer Millhouse',
        chapter: '15',
        courtDivisionCode: '081',
        dateFiled: getYearMonthDayStringFromDate(
          new Date(today.getFullYear(), today.getMonth() - 7, today.getDate()),
        ),
        assignments: ['Mr. Jones', 'Diana', 'Joe'],
        courtId: '',
        courtDivisionName: '',
        courtName: '',
        dxtrId: '0',
        groupDesignator: '',
        officeCode: '',
        officeName: '',
        regionId: '',
        regionName: '',
        debtor: {
          name: 'DebtorName',
        },
      },
      {
        caseId: '081-13-01166',
        caseTitle: 'Heather Anne Real',
        chapter: '15',
        courtDivisionCode: '081',
        dateFiled: getYearMonthDayStringFromDate(
          new Date(today.getFullYear() - 10, today.getMonth(), today.getDate()),
        ),
        assignments: [],
        courtId: '',
        courtDivisionName: '',
        courtName: '',
        dxtrId: '0',
        groupDesignator: '',
        officeCode: '',
        officeName: '',
        regionId: '',
        regionName: '',
        debtor: {
          name: 'DebtorName',
        },
      },
    );
    this.caseList.push(...oldCases);

    // Add Cases newer than 6 months
    const newCases: CaseDetail[] = [];

    newCases.push(
      {
        caseId: '081-23-01167',
        caseTitle: 'Heather Anne Real',
        chapter: '15',
        courtDivisionCode: '081',
        dateFiled: getYearMonthDayStringFromDate(
          new Date(today.getFullYear(), today.getMonth() - 1, today.getDate()),
        ),
        assignments: [],
        courtId: '',
        courtDivisionName: '',
        courtName: '',
        dxtrId: '0',
        groupDesignator: '',
        officeCode: '',
        officeName: '',
        regionId: '',
        regionName: '',
        debtor: {
          name: 'DebtorName',
        },
      },
      {
        caseId: '081-23-01175',
        caseTitle: 'James P. Tennor',
        chapter: '15',
        courtDivisionCode: '081',
        dateFiled: getYearMonthDayStringFromDate(
          new Date(today.getFullYear(), today.getMonth() - 3, today.getDate()),
        ),
        assignments: ['Daisy', 'Roger', 'Frank'],
        courtId: '',
        courtDivisionName: '',
        courtName: '',
        dxtrId: '0',
        groupDesignator: '',
        officeCode: '',
        officeName: '',
        regionId: '',
        regionName: '',
        debtor: {
          name: 'DebtorName',
        },
      },
      {
        caseId: '081-23-01176',
        caseTitle: 'Tommy Testformiddlena tennor',
        chapter: '15',
        courtDivisionCode: '081',
        dateFiled: getYearMonthDayStringFromDate(
          new Date(today.getFullYear(), today.getMonth() - 2, today.getDate()),
        ),
        assignments: [],
        courtId: '',
        courtDivisionName: '',
        courtName: '',
        dxtrId: '0',
        groupDesignator: '',
        officeCode: '',
        officeName: '',
        regionId: '',
        regionName: '',
        debtor: {
          name: 'DebtorName',
        },
      },
    );
    this.caseList.push(...newCases);
  }
}
