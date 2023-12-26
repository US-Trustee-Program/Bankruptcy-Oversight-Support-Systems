import { NotFoundError } from '../../../common-errors/not-found-error';
import { CaseDocket } from '../../../use-cases/case-docket/case-docket.model';
import { ApplicationContext } from '../../types/basic';
import { CaseDocketGateway } from '../../../use-cases/gateways.types';
import { GatewayHelper } from '../gateway-helper';
import { NORMAL_CASE_ID } from '../../../testing/testing-constants';

const MODULENAME = 'CASE-DOCKET-MOCK-GATEWAY';

export class MockCaseDocketGateway implements CaseDocketGateway {
  async getCaseDocket(_context: ApplicationContext, caseId: string): Promise<CaseDocket> {
    const gatewayHelper = new GatewayHelper();
    if (caseId === NORMAL_CASE_ID) {
      return Promise.resolve(gatewayHelper.getCaseDocketEntriesMockExtract());
    }
    return Promise.reject(new NotFoundError(MODULENAME, { data: { caseId } }));
  }
}
