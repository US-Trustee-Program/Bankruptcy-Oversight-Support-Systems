import Api from './api';
import { AttorneyListResponseData } from '../components/AssignAttorneyModal';

export default class AttorneysApi {
  public static async getAttorneys() {
    return Api.list('/attorneys').then((response) => {
      return (response.body as AttorneyListResponseData).attorneyList;
    });
  }
}
