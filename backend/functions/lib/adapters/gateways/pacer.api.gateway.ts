import { Chapter15Case } from '../types/cases';
import * as dotenv from 'dotenv';
import { PacerGatewayInterface } from '../../use-cases/pacer.gateway.interface';
import { pacerToChapter15Data } from '../../interfaces/chapter-15-data-interface';
import { httpPost } from '../utils/http';
import { PacerLogin } from './pacer-login';
import { getPacerTokenSecretGateway } from '../../../factory';
import { CaseLocatorException } from './pacer-exceptions';

dotenv.config();

class PacerApiGateway implements PacerGatewayInterface {
  private pacerLogin: PacerLogin;
  private token: string;
  private startingMonth: number = -6;

  constructor() {
    this.pacerLogin = new PacerLogin(getPacerTokenSecretGateway());
  }

  private handleExpiredToken = async () => {
    this.token = await this.pacerLogin.getAndStorePacerToken();
    return this.searchCaseLocator();
  };

  private searchCaseLocator = async (): Promise<Chapter15Case[]> => {
    const date = new Date();
    date.setMonth(date.getMonth() + this.startingMonth);
    const dateFileFrom = date.toISOString().split('T')[0];
    const regionTwoPacerCourtIds = ['nyebk', 'nynbk', 'nysbk', 'nywbk', 'vtbk', 'ctbk'];

    const body = {
      jurisdictionType: 'bk',
      courtId: regionTwoPacerCourtIds,
      federalBankruptcyChapter: ['15'],
      dateFiledFrom: dateFileFrom,
    };
    const pacerCaseLocatorUrlBase = process.env.PACER_CASE_LOCATOR_URL;
    const pacerCaseLocatorUrlPath = '/pcl-public-api/rest/cases/find';

    const response = await httpPost({
      url: `${pacerCaseLocatorUrlBase}${pacerCaseLocatorUrlPath}`,
      headers: { 'X-NEXT-GEN-CSO': this.token },
      body,
    });

    if (response.status != 200) {
      throw new CaseLocatorException(response.status, 'Unexpected response from Pacer API');
    }

    return pacerToChapter15Data(response.data.content);
  };

  public getChapter15Cases = async (startingMonth?: number): Promise<Chapter15Case[]> => {
    if (startingMonth != undefined) {
      this.startingMonth = startingMonth;
    }

    try {
      this.token = await this.pacerLogin.getPacerToken();
      const result = await this.searchCaseLocator();
      return result;
    } catch (e) {
      if (e instanceof CaseLocatorException && e.status === 401) {
        await this.handleExpiredToken();
      } else {
        throw e;
      }
    }
  };
}

export { PacerApiGateway };
