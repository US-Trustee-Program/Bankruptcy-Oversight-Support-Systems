import { ResponseData } from '../type-declarations/api';
import Api from './api';

export default class Chapter15MockApi extends Api {
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
      case '/attorneys':
        response = {
          message: 'attorneys list',
          count: Chapter15MockApi.attorneyList.length,
          body: { attorneyList: Chapter15MockApi.attorneyList },
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

  static caseList = [
    {
      caseNumber: '23-44463',
      caseTitle: 'Flo Esterly and Neas Van Sampson',
      dateFiled: '05-04-2023',
    },
    {
      caseNumber: '23-44462',
      caseTitle: 'Bridget Maldonado',
      dateFiled: '04-14-2023',
    },
    {
      caseNumber: '23-44461',
      caseTitle: 'Talia Torres and Tylor Stevenson',
      dateFiled: '04-04-2023',
    },
    {
      caseNumber: '23-44460',
      caseTitle: 'Asia Hodges',
      dateFiled: '03-01-2023',
    },
    {
      caseNumber: '23-44459',
      caseTitle: 'Marilyn Lawson',
      dateFiled: '02-14-2023',
    },
    {
      caseNumber: '23-44458',
      caseTitle: 'April Pierce and Leah Pierce',
      dateFiled: '02-04-2023',
    },
    {
      caseNumber: '23-44457',
      caseTitle: 'Corinne Gordon',
      dateFiled: '01-14-2023',
    },
    {
      caseNumber: '23-44456',
      caseTitle: 'Marilyn Lang and Rudy Bryant',
      dateFiled: '01-04-2023',
    },
  ];

  static attorneyList = [
    {
      caseLoad: 3,
      firstName: 'Debora',
      generation: '',
      lastName: 'Henderson',
      middleName: 'Cindy',
    },
    {
      caseLoad: 6,
      firstName: 'Adele',
      generation: '',
      lastName: 'Greene',
      middleName: 'Joann',
    },
    {
      caseLoad: 2,
      firstName: 'Brock',
      generation: '',
      lastName: 'Scott',
      middleName: 'Stuart',
    },
    {
      caseLoad: 7,
      firstName: 'Katherine',
      generation: '',
      lastName: 'Hess',
      middleName: 'Jewell',
    },
    {
      caseLoad: 4,
      firstName: 'Lawrence',
      generation: '',
      lastName: 'Heath',
      middleName: 'Josiah',
    },
  ];
}
