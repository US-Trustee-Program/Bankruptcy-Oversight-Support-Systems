import { Chapter15Case } from '../types/cases';
import * as dotenv from 'dotenv';
import { PacerGatewayInterface } from '../types/pacer.gateway';
import { pacerToChapter15Data } from '../../interfaces/chapter-15-data-interface';
import { httpPost } from '../utils/http';
import { PacerLogin } from './pacer-login';
import { getPacerTokenSecretGateway } from '../../factory';
import { CaseLocatorException } from './pacer-exceptions';
import { HttpResponse } from '../types/http';
import { Context } from '../types/basic';
import log from '../services/logger.service';

const NAMESPACE = 'PACER-API-GATEWAY';
dotenv.config();

class PacerApiGateway implements PacerGatewayInterface {
  private pacerLogin: PacerLogin;
  private token: string;

  constructor() {
    this.pacerLogin = new PacerLogin(getPacerTokenSecretGateway());
  }

  private async handleExpiredToken(context: Context, startingMonth: number) {
    this.token = await this.pacerLogin.getAndStorePacerToken(context);
    return this.searchCaseLocator(context, startingMonth);
  }

  private async searchCaseLocator(context: Context, startingMonth: number): Promise<Chapter15Case[]> {
    const date = new Date();
    date.setMonth(date.getMonth() + startingMonth);
    const dateFileFrom = date.toISOString().split('T')[0];
    const regionTwoPacerCourtIds = ['cm8bk', 'nyebk', 'nynbk', 'nysbk', 'nywbk', 'vtbk', 'ctbk'];

    const body = {
      jurisdictionType: 'bk',
      courtId: regionTwoPacerCourtIds,
      federalBankruptcyChapter: ['15'],
      dateFiledFrom: dateFileFrom,
    };
    const response = await this.getCasesListFromPacerApi(context, body).catch((exception) => {
      log.error(context, NAMESPACE, `PACER Case Locator API exception with ${exception.status} status: ${exception.message}`);
      throw new CaseLocatorException(exception.status, exception.message);
    });

    if (response.status != 200) {
      log.error(context, NAMESPACE, `PACER Case Locator API returned ${response.status} response.`);
      throw new CaseLocatorException(response.status, 'Unexpected response from Pacer API');
    }

    return pacerToChapter15Data(response.data.content);
  }

  public async getCasesListFromPacerApi(context: Context, body: {}): Promise<HttpResponse> {
    const pacerCaseLocatorUrlBase = process.env.PACER_CASE_LOCATOR_URL;
    const pacerCaseLocatorUrlPath = '/pcl-public-api/rest/cases/find';

    log.info(context, NAMESPACE, `Retrieving cases from PACER with the following request body: ${JSON.stringify(body)}`);
    return await httpPost({
      url: `${pacerCaseLocatorUrlBase}${pacerCaseLocatorUrlPath}`,
      headers: { 'X-NEXT-GEN-CSO': this.token },
      body,
    });
  }

  public async getChapter15Cases(context: Context, startingMonth?: number): Promise<Chapter15Case[]> {
    startingMonth = startingMonth || -6;

    try {
      this.token = await this.pacerLogin.getPacerToken(context);
      return await this.searchCaseLocator(context, startingMonth);
    } catch (e) {
      if (e instanceof CaseLocatorException && e.status === 401) {
        await this.handleExpiredToken(context, startingMonth);
      } else {
        throw e;
      }
    }
  }
}

export { PacerApiGateway };
