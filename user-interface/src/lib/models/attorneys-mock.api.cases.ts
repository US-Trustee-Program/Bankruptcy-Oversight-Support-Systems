import { ResponseData } from '../type-declarations/api';

export default class AttorneysMockApi {
  public static async list(path: string): Promise<ResponseData> {
    let response: ResponseData;
    switch (path) {
      case '/attorneys':
        response = {
          message: 'attorneys list',
          count: AttorneysMockApi.attorneyList.length,
          body: { attorneyList: AttorneysMockApi.attorneyList },
        };
        break;
      default:
        response = {
          message: 'not found',
          count: 0,
          body: {
            attorneyList: [],
          },
        };
    }
    return Promise.resolve(response);
  }

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
