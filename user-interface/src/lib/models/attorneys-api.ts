import Api from './api';
import { AttorneyListResponseData } from '@/case-assignment/AssignAttorneyModal';
import AttorneysMockApi from './attorneys-mock.api.cases';

export default class AttorneysApi {
  public static async getAttorneys() {
    const api = import.meta.env['CAMS_PA11Y'] === 'true' ? AttorneysMockApi : Api;
    return api.list('/attorneys').then((response) => {
      const attorneys = (response.body as AttorneyListResponseData).attorneyList;
      return attorneys;
    });
  }
}
