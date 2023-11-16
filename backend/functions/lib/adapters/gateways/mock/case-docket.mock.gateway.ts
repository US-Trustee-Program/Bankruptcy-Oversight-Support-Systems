import { CaseDocket } from '../../../use-cases/case-docket/case-docket.model';
import { CaseDocketGateway } from '../gateways.types';
import { GatewayHelper } from '../gateway-helper';

export class MockCaseDocketGateway implements CaseDocketGateway {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async getCaseDocket(_caseId: string): Promise<CaseDocket> {
    const gatewayHelper = new GatewayHelper();
    return Promise.resolve(gatewayHelper.getCaseDocketEntriesMockExtract());
  }
}
