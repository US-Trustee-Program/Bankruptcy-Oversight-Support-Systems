import { NotFoundError } from '../../../common-errors/not-found-error';
import { ApplicationContext } from '../../types/basic';
import { CaseDocketGateway } from '../../../use-cases/gateways.types';
import { GatewayHelper } from '../gateway-helper';
import { NORMAL_CASE_ID } from '../../../testing/testing-constants';
import { CaseDocket } from '@common/cams/cases';

const MODULE_NAME = 'CASE-DOCKET-MOCK-GATEWAY';

export class MockCaseDocketGateway implements CaseDocketGateway {
  async getCaseDocket(_context: ApplicationContext, caseId: string): Promise<CaseDocket> {
    const gatewayHelper = new GatewayHelper();
    if (caseId === NORMAL_CASE_ID) {
      return Promise.resolve(gatewayHelper.getCaseDocketEntriesMockExtract());
    }
    return Promise.reject(new NotFoundError(MODULE_NAME, { data: { caseId } }));
  }
}
