import { CaseDocketGateway } from '../gateways.types';
import { ApplicationContext } from '../../adapters/types/basic';
import { CaseDocket } from '@common/cams/cases';

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
