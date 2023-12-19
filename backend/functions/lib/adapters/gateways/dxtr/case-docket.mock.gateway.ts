/* eslint-disable @typescript-eslint/no-unused-vars */
import { NotFoundError } from '../../../common-errors/not-found-error';
import { CaseDocket } from '../../../use-cases/case-docket/case-docket.model';
import { ApplicationContext } from '../../types/basic';
import { CaseDocketGateway } from '../../../use-cases/gateways.types';
import { GatewayHelper } from '../gateway-helper';

const MODULENAME = 'CASE-DOCKET-MOCK-GATEWAY';

export const NORMAL_CASE_ID = '111-11-11111';
export const NOT_FOUND_ERROR_CASE_ID = '000-00-00000';

export class MockCaseDocketGateway implements CaseDocketGateway {
  async getCaseDocket(_context: ApplicationContext, caseId: string): Promise<CaseDocket> {
    const gatewayHelper = new GatewayHelper();
    if (caseId === NORMAL_CASE_ID) {
      return Promise.resolve(gatewayHelper.getCaseDocketEntriesMockExtract());
    }
    return Promise.reject(new NotFoundError(MODULENAME, { data: { caseId } }));
  }
}
