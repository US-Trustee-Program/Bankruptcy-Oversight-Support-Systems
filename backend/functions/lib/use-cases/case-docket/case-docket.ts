import { CaseDocketGateway } from '../../adapters/gateways/gateways.types';
import { ApplicationContext } from '../../adapters/types/basic';
import { CaseDocket } from './case-docket.model';

export class CaseDocketUseCase {
  private readonly gateway: CaseDocketGateway;

  constructor(gateway: CaseDocketGateway) {
    this.gateway = gateway;
  }

  public async getCaseDocket(context: ApplicationContext, caseId: string): Promise<CaseDocket> {
    return this.gateway.getCaseDocket(context, caseId);
  }
}
