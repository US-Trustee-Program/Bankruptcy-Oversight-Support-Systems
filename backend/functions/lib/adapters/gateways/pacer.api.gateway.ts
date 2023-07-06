import { Chapter15Case } from '../types/cases';
import * as dotenv from 'dotenv';
import { PacerGatewayInterface } from '../../use-cases/pacer.gateway.interface';
import { pacerToChapter15Data } from '../../interfaces/chapter-15-data-interface';
import { httpPost } from '../utils/http';
import { PacerLogin } from './pacer-login';
import { getPacerTokenSecretGateway } from '../../../factory';
import { CaseLocatorException } from './pacer-exceptions';
import { HttpResponse } from '../types/http';
import { Context } from '../types/basic';
import log from '../services/logger.service';

const NAMESPACE = 'PACER-API-GATEWAY';
dotenv.config();

class PacerApiGateway implements PacerGatewayInterface {
  private pacerLogin: PacerLogin;
  private token: string;
  private _startingMonth: number;

  constructor() {
    this.pacerLogin = new PacerLogin(getPacerTokenSecretGateway());
    this.startingMonth = -6;
  }

  get startingMonth(): number {
    return this._startingMonth;
  }

  set startingMonth(value: number) {
    this._startingMonth = value;
  }

  private async handleExpiredToken(context: Context) {
    this.token = await this.pacerLogin.getAndStorePacerToken(context);
    return this.searchCaseLocator(context);
  }

  private async searchCaseLocator(context: Context): Promise<Chapter15Case[]> {
    const date = new Date();
    date.setMonth(date.getMonth() + this.startingMonth);
    const dateFileFrom = date.toISOString().split('T')[0];
    const regionTwoPacerCourtIds = ['cm8bk', 'nyebk', 'nynbk', 'nysbk', 'nywbk', 'vtbk', 'ctbk'];

    const body = {
      jurisdictionType: 'bk',
      courtId: regionTwoPacerCourtIds,
      federalBankruptcyChapter: ['15'],
      dateFiledFrom: dateFileFrom,
    };
    const response = await this.getCasesListFromPacerApi(body, context).catch(exception => {
      log.error(context, NAMESPACE, `PACER Case Locator API exception with ${exception.status} status: ${exception.message}`);
      throw new CaseLocatorException(exception.status, exception.message);
    });

    if (response.status != 200) {
      log.error(context, NAMESPACE, `PACER Case Locator API returned ${response.status} response.`);
      throw new CaseLocatorException(response.status, 'Unexpected response from Pacer API');
    }

    return pacerToChapter15Data(response.data.content);
  }

  public async getCasesListFromPacerApi(body: {}, context: Context): Promise<HttpResponse> {
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
    if (startingMonth != undefined) {
      this.startingMonth = startingMonth;
    }

    try {
      this.token = await this.pacerLogin.getPacerToken(context);
      return await this.searchCaseLocator(context);
    } catch (e) {
      if (e instanceof CaseLocatorException && e.status === 401) {
        await this.handleExpiredToken(context);
      } else {
        throw e;
      }
    }
  }
}

export { PacerApiGateway };
