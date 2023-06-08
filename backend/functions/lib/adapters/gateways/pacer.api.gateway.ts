import { Chapter15Case } from '../types/cases';
import * as dotenv from 'dotenv';
import { PacerGatewayInterface } from "../../use-cases/pacer.gateway.interface";
import { pacerToChapter15Data } from '../../interfaces/chapter-15-data-interface';
import {axiosPost, httpPost} from '../utils/http'

dotenv.config();

class PacerApiGateway implements PacerGatewayInterface {
  getChapter15Cases = async (startingMonth: number = -6): Promise<Chapter15Case[]> => {
    const date = new Date();
    date.setMonth(date.getMonth() + startingMonth);
    const dateFileFrom = date.toISOString().split('T')[0];
    const regionTwoPacerCourtIds = '["nyebk", "nynbk", "nysbk", "nywbk", "vtbk", "ctbk"]';

    const body = `{
            "jurisdictionType": "bk",
            "courtId": ${regionTwoPacerCourtIds},
            "federalBankruptcyChapter": [
                "15"
            ],
            "dateFiledFrom": "${dateFileFrom}"
        }`;

    let token = await this.getPacerToken();
    const response = await httpPost({
      url: 'https://qa-pcl.uscourts.gov/pcl-public-api/rest/cases/find?page=0',
      headers: {'X-NEXT-GEN-CSO': token},
      body
    });

    if (response.status != 200) {
      return Promise.reject(await response.json());
    } else {
      const responseJson = await response.json();
      return pacerToChapter15Data(responseJson.content);
    }


  }

  getPacerToken = async (): Promise<string> => {
    const response = await axiosPost({
      url: 'https://qa-login.uscourts.gov/services/cso-auth',
      body: {
        "loginId": "username",
        "password": "password"
      },
    });

    validateResponse(response);

    return response.data.nextGenCSO;
  }
}
function validateResponse(response: any) {
  if (response.status != 200 || !!response.data.errorDescription || !response.data.nextGenCSO) {
    throw new Error('Failed to obtain PACER login token.');
  }
}

export { PacerApiGateway }
