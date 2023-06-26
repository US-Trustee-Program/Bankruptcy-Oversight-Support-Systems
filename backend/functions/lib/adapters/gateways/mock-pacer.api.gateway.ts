import { PacerGatewayInterface } from '../../use-cases/pacer.gateway.interface';
import { Chapter15Case } from '../types/cases';

export class MockPacerApiGateway implements PacerGatewayInterface {
  startingMonth: number;
  private chapter15CaseList: Chapter15Case[] = [];

  constructor() {
    this.setUpChapter15TestCaseList();
    this.startingMonth = -6;
  }

  async getChapter15Cases(startingMonth?: number): Promise<Chapter15Case[]> {
    if (startingMonth != undefined) {
      this.startingMonth = startingMonth;
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

  private filterMonths(cases: Chapter15Case[], filterDateGreaterThan) {
    //
  }
  private setUpChapter15TestCaseList() {
    //Add Cases older than 6 months
    let oldCases: Chapter15Case[] = [];
    let today = new Date();

    oldCases.push(
      {
        // "courtId": "cm8bk",
        // "caseId": 127352,
        // "caseYear": today.getFullYear()-4,
        caseNumber: '44449',
        // "caseOffice": "4",
        // "caseType": "bk",
        caseTitle: 'Flo Esterly and Neas Van Sampson',
        dateFiled: new Date(today.getFullYear() - 4, today.getMonth() - 10, today.getDate())
          .toISOString()
          .split('T')[0],
        // "bankruptcyChapter": "15",
        // "jointBankruptcyFlag": "n",
        // "jurisdictionType": "Bankruptcy",
        // "caseNumberFull": "4:2004bk44449"
      },
      {
        // "courtId": "cm8bk",
        // "caseId": 127761,
        // "caseYear": today.getFullYear(),
        caseNumber: '1122',
        // "caseOffice": "1",
        // "caseType": "bk",
        caseTitle: 'Jennifer Millhouse',
        dateFiled: new Date(today.getFullYear(), today.getMonth() - 7, today.getDate())
          .toISOString()
          .split('T')[0],
        // "dateTermed": "2008-08-11",
        // "dateDischarged": "2008-08-11",
        // "bankruptcyChapter": "15",
        // "dispositionMethod": "Standard Discharge",
        // "jointBankruptcyFlag": "n",
        // "jurisdictionType": "Bankruptcy",
        // "effectiveDateClosed": "2008-08-11",
        // "caseNumberFull": "1:2006bk01122"
      },
      {
        // "courtId": "cm8bk",
        // "caseId": 127827,
        // "caseYear": today.getFullYear()-10,
        caseNumber: '1166',
        // "caseOffice": "1",
        // "caseType": "bk",
        caseTitle: 'Heather Anne Real',
        dateFiled: new Date(today.getFullYear() - 10, today.getMonth(), today.getDate())
          .toISOString()
          .split('T')[0],
        // "dateDischarged": "2007-10-26",
        // "bankruptcyChapter": "15",
        // "jointBankruptcyFlag": "n",
        // "jurisdictionType": "Bankruptcy",
        // "caseNumberFull": "1:2006bk01166"
      },
    );
    this.chapter15CaseList.push(oldCases[0], oldCases[1], oldCases[2]);

    // Add Cases newer than 6 months
    let newCases: Chapter15Case[] = [];

    newCases.push(
      {
        // "courtId": "cm8bk",
        // "caseId": 127828,
        // "caseYear": today.getFullYear(),
        caseNumber: '1167',
        // "caseOffice": "1",
        // "caseType": "bk",
        caseTitle: 'Heather Anne Real',
        dateFiled: new Date(today.getFullYear(), today.getMonth() - 1, today.getDate())
          .toISOString()
          .split('T')[0],
        // "dateDischarged": "2007-10-26",
        // "bankruptcyChapter": "15",
        // "jointBankruptcyFlag": "n",
        // "jurisdictionType": "Bankruptcy",
        // "caseNumberFull": "1:2006bk01167"
      },
      {
        // "courtId": "cm8bk",
        // "caseId": 127836,
        // "caseYear": today.getFullYear(),
        caseNumber: '1175',
        // "caseOffice": "1",
        // "caseType": "bk",
        caseTitle: 'James P. Tennor',
        dateFiled: new Date(today.getFullYear(), today.getMonth() - 3, today.getDate())
          .toISOString()
          .split('T')[0],
        // "dateDischarged": "2007-10-26",
        // "bankruptcyChapter": "15",
        // "jointBankruptcyFlag": "n",
        // "jurisdictionType": "Bankruptcy",
        // "caseNumberFull": "1:2006bk01175"
      },
      {
        // "courtId": "cm8bk",
        // "caseId": 127837,
        // "caseYear": today.getFullYear(),
        caseNumber: '1176',
        // "caseOffice": "1",
        // "caseType": "bk",
        caseTitle: 'Tommy Testformiddlena tennor',
        dateFiled: new Date(today.getFullYear(), today.getMonth() - 2, today.getDate())
          .toISOString()
          .split('T')[0],
        // "dateDischarged": "2007-10-26",
        // "bankruptcyChapter": "15",
        // "jointBankruptcyFlag": "n",
        // "jurisdictionType": "Bankruptcy",
        // "caseNumberFull": "1:2006bk01176"
      },
    );
    this.chapter15CaseList.push(newCases[0], newCases[1], newCases[2]);
  }
}
