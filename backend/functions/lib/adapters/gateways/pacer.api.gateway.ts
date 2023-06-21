import { Chapter15Case } from '../types/cases';
import * as dotenv from 'dotenv';
import { PacerGatewayInterface } from '../../use-cases/pacer.gateway.interface';
import { pacerToChapter15Data } from '../../interfaces/chapter-15-data-interface';
import { httpPost } from '../utils/http';
import { PacerLogin } from './pacer-login';
import { getPacerTokenSecretGateway } from '../../../factory';

dotenv.config();

class PacerApiGateway implements PacerGatewayInterface {
  getChapter15Cases = async (startingMonth: number = -6): Promise<Chapter15Case[]> => {
    const pacerLogin = new PacerLogin(getPacerTokenSecretGateway());
    let token: string;
    try {
      token = await pacerLogin.getPacerToken();
      return await this.searchCaseLocator(token, startingMonth);
    } catch (e) {
      const expiredToken = e.response?.data?.status === 401 || false;
      if (expiredToken) {
        token = await pacerLogin.getAndStorePacerToken();
        return this.searchCaseLocator(token, startingMonth);
      } else {
        throw e;
      }
    }
  };

  searchCaseLocator = async (token: string, startingMonth: number): Promise<Chapter15Case[]> => {
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
    const pacerCaseLocatorUrlBase = process.env.PACER_CASE_LOCATOR_URL;
    const pacerCaseLocatorUrlPath = '/pcl-public-api/rest/cases/find?page=0';

    const response = await httpPost({
      url: `${pacerCaseLocatorUrlBase}${pacerCaseLocatorUrlPath}`,
      headers: { 'X-NEXT-GEN-CSO': token },
      body,
    });

    if (response.status != 200) {
      throw new Error('Unexpected response from Pacer API');
    }

    return pacerToChapter15Data(response.data);
  };
}

export { PacerApiGateway };
