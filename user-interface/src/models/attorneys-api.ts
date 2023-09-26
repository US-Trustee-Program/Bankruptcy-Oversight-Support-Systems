import Api from './api';
import { AttorneyListResponseData } from '../components/AssignAttorneyModal';
import MockApi from './chapter15-mock.api.cases';

export default class AttorneysApi {
  public static async getAttorneys() {
    const api = import.meta.env['CAMS_PA11Y'] === 'true' ? MockApi : Api;
    return api.list('/attorneys').then((response) => {
      return (response.body as AttorneyListResponseData).attorneyList;
    });
  }
}
