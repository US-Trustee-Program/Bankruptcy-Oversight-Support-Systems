import { CaseDocketGateway } from '../../adapters/gateways/gateways.types';
import { ApplicationContext } from '../../adapters/types/basic';
import { CaseDocket } from './case-docket.model';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const MODULE_NAME = 'CASE-DOCKET-USE-CASE';

export class CaseDocketUseCase {
  private readonly context: ApplicationContext;
  private readonly gateway: CaseDocketGateway;

  constructor(context: ApplicationContext, gateway: CaseDocketGateway) {
    this.context = context;
    this.gateway = gateway;
  }

  public async getCaseDocket(caseId: string): Promise<CaseDocket> {
    return this.gateway.getCaseDocket(caseId);
  }
}
