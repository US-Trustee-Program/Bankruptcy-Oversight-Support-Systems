import { Chapter15Case } from '../types/cases';
import * as dotenv from 'dotenv';
import { PacerGatewayInterface } from '../../use-cases/pacer.gateway.interface';
import { pacerToChapter15Data } from '../../interfaces/chapter-15-data-interface';
import { httpGet, httpPost } from '../utils/http';
import { PacerLogin } from './pacer-login';

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

    const pacerLogin = new PacerLogin();
    let token;
    try {
      token = await pacerLogin.getPacerToken();

      const pacerCaseLocatorUrlBase = process.env.PACER_CASE_LOCATOR_URL;
      const pacerCaseLocatorUrlPath = '/pcl-public-api/rest/cases/find?page=0';

      const response = await httpPost({
        url: `${pacerCaseLocatorUrlBase}${pacerCaseLocatorUrlPath}`,
        headers: { 'X-NEXT-GEN-CSO': token },
        body,
      });

      if (response.status != 200) {
        throw new Error('Unexpected response from Pacer API');
      } else {
        return pacerToChapter15Data(response.data.content);
      }
    } catch (e) {
      throw e;
    }
  };
}

export { PacerApiGateway };
