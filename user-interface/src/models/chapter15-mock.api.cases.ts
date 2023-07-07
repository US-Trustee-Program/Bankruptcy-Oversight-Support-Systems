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
      default:
        response = {
          message: 'not found',
          count: 0,
          body: {},
        };
    }
    return Promise.resolve(response);
  }

  static caseList = [
    {
      caseNumber: '23-44463',
      caseTitle: 'Flo Esterly and Neas Van Sampson',
      dateFiled: '2023-05-04',
    },
    {
      caseNumber: '23-44462',
      caseTitle: 'Bridget Maldonado',
      dateFiled: '2023-04-14',
    },
    {
      caseNumber: '23-44461',
      caseTitle: 'Talia Torres and Tylor Stevenson',
      dateFiled: '2023-04-04',
    },
    {
      caseNumber: '23-44460',
      caseTitle: 'Asia Hodges',
      dateFiled: '2023-03-01',
    },
    {
      caseNumber: '23-44459',
      caseTitle: 'Marilyn Lawson',
      dateFiled: '2023-02-14',
    },
    {
      caseNumber: '23-44458',
      caseTitle: 'April Pierce and Leah Pierce',
      dateFiled: '2023-02-04',
    },
    {
      caseNumber: '23-44457',
      caseTitle: 'Corinne Gordon',
      dateFiled: '2023-01-14',
    },
    {
      caseNumber: '23-44456',
      caseTitle: 'Marilyn Lang and Rudy Bryant',
      dateFiled: '2023-01-04',
    },
  ];
}
