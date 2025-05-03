import { CaseDocket } from '../../../../common/src/cams/cases';
import { ApplicationContext } from '../../adapters/types/basic';
import { CaseDocketGateway } from '../gateways.types';

export class CaseDocketUseCase {
  private readonly gateway: CaseDocketGateway;

  constructor(gateway: CaseDocketGateway) {
    this.gateway = gateway;
  }

  public async getCaseDocket(context: ApplicationContext): Promise<CaseDocket> {
    const caseId = context.request.params.caseId;
    return this.gateway.getCaseDocket(context, caseId);
  }
}
