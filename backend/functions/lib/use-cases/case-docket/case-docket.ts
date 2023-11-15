import CaseDocketDxtrGateway from '../../adapters/gateways/dxtr/case-docket.dxtr.gateway';
import { ApplicationContext } from '../../adapters/types/basic';
import { CaseDocket } from './case-docket.model';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const MODULE_NAME = 'CASE-DOCKET-USE-CASE';

export class CaseDocketUseCase {
  applicationContext: ApplicationContext;
  gateway: CaseDocketDxtrGateway;

  constructor(applicationContext: ApplicationContext) {
    this.applicationContext = applicationContext;
    this.gateway = new CaseDocketDxtrGateway();
  }

  public async getCaseDocket(caseId: string): Promise<CaseDocket> {
    return this.gateway.getCaseDocket(this.applicationContext, caseId);
  }
}
