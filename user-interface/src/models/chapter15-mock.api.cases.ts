import { ResponseData } from '../type-declarations/api';
import { CaseDetailType, Chapter15CaseDetailsResponseData } from '../type-declarations/chapter-15';
import Api from './api';

export default class Chapter15MockApi extends Api {
  static caseList = [
    {
      caseId: '101-23-44463',
      caseTitle: 'Flo Esterly and Neas Van Sampson',
      dateFiled: '05-04-2023',
    },
    {
      caseId: '101-23-44462',
      caseTitle: 'Bridget Maldonado',
      dateFiled: '04-14-2023',
    },
    {
      caseId: '101-23-44461',
      caseTitle: 'Talia Torres and Tylor Stevenson',
      dateFiled: '04-04-2023',
    },
    {
      caseId: '101-23-44460',
      caseTitle: 'Asia Hodges',
      dateFiled: '03-01-2023',
    },
    {
      caseId: '101-23-44459',
      caseTitle: 'Marilyn Lawson',
      dateFiled: '02-14-2023',
    },
    {
      caseId: '101-23-44458',
      caseTitle: 'April Pierce and Leah Pierce',
      dateFiled: '02-04-2023',
    },
    {
      caseId: '101-23-44457',
      caseTitle: 'Corinne Gordon',
      dateFiled: '01-14-2023',
    },
    {
      caseId: '101-23-44456',
      caseTitle: 'Marilyn Lang and Rudy Bryant',
      dateFiled: '01-04-2023',
    },
  ];

  static caseDetails: CaseDetailType = {
    caseId: '101-23-12345',
    chapter: '15',
    regionId: '02',
    officeName: 'New York',
    courtName: 'Southern District of New York',
    caseTitle: 'Débora Arden Coronado Nazario III',
    dateFiled: '02-15-2023',
    judgeName: 'Meyer Steven',
    assignments: ['Brian Wilson', 'Carl Wilson', 'Dennis Wilson', 'Mike Love', 'Al Jardine'],
    debtor: {
      name: 'Débora Arden Coronado Nazario III',
      address1: 'Huerta Cedro 3',
      address2: 'Edificio 9',
      cityStateZipCountry: 'Miramar DG 30849 Mexico',
      ssn: '010-10-1010',
      taxId: '12-1234567',
    },
    debtorAttorney: {
      name: 'Julio César Kyle Contreras de Caballero Mtro.',
      address1: 'Pasaje Martín Salcido 4929',
      address2: 'Puerta 248',
      cityStateZipCountry: 'Irapuato HG 82513 Mexico',
      phone: '5992-349-234',
      email: 'testemail@email.com',
    },
  };

  public static async list(path: string): Promise<ResponseData> {
    let response: ResponseData;
    switch (path) {
      case '/cases':
        response = {
          message: '',
          count: Chapter15MockApi.caseList.length,
          body: {
            caseList: Chapter15MockApi.caseList,
          },
        };
        break;
      default:
        response = {
          message: 'not found',
          count: 0,
          body: {
            caseList: [],
          },
        };
    }
    return Promise.resolve(response);
  }

  public static async get(path: string): Promise<Chapter15CaseDetailsResponseData> {
    let response: ResponseData;
    if (path.match(/\/cases\/[\d-]+/)) {
      response = {
        message: '',
        count: 1,
        body: {
          caseDetails: Chapter15MockApi.caseDetails,
        },
      };
    } else {
      response = {
        message: 'not found',
        count: 0,
        body: {
          caseDetails: {},
        },
      };
    }

    return Promise.resolve(response as Chapter15CaseDetailsResponseData);
  }
}
