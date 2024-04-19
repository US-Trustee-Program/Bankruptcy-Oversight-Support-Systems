import Api from './api';
import { AttorneyListResponseData } from '@/case-assignment/AssignAttorneyModal';
import AttorneysMockApi from './attorneys-mock.api.cases';
import { Attorney } from '../type-declarations/attorneys';

export default class AttorneysApi {
  public static async getAttorneys() {
    const api = import.meta.env['CAMS_PA11Y'] === 'true' ? AttorneysMockApi : Api;
    return api.list('/attorneys').then((response) => {
      const data = (response.body as AttorneyListResponseData).attorneyList;
      const attorneys = data.map((atty) => {
        const attorney = new Attorney(atty.firstName, atty.lastName, atty.office);
        if (atty.middleName !== undefined) attorney.middleName = atty.middleName;
        if (atty.generation !== undefined) attorney.generation = atty.generation;
        if (atty.caseLoad !== undefined) attorney.caseLoad = atty.caseLoad;
        return attorney;
      });
      return attorneys;
    });
  }
}
