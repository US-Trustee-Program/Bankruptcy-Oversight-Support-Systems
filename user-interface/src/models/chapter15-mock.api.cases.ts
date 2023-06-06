import Api, { ResponseData } from './api';

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
      caseTitle: 'Figs orange Bolivian',
      dateFiled: '2023-04-14',
    },
    {
      caseNumber: '23-44461',
      caseTitle: 'rainbow pepper lemon lime',
      dateFiled: '2023-04-04',
    },
    {
      caseNumber: '23-44460',
      caseTitle: 'brussel sprouts',
      dateFiled: '2023-03-01',
    },
    {
      caseNumber: '23-44459',
      caseTitle: 'bananas blueberry chia seed',
      dateFiled: '2023-02-14',
    },
    {
      caseNumber: '23-44458',
      caseTitle: 'Almond milk fiery fruit',
      dateFiled: '2023-02-04',
    },
    {
      caseNumber: '23-44457',
      caseTitle: 'red curry tofu noodles',
      dateFiled: '2023-01-14',
    },
    {
      caseNumber: '23-44456',
      caseTitle: 'asian pear maple orange',
      dateFiled: '2023-01-04',
    },
  ];
}
