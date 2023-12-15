import { CaseHistoryGateway } from '../gateways.types';
import { ApplicationContext } from '../../adapters/types/basic';
import { CaseAssignmentHistory } from '../../adapters/types/case.assignment';

export class CaseHistoryUseCase {
  private readonly gateway: CaseHistoryGateway;

  constructor(gateway: CaseHistoryGateway) {
    this.gateway = gateway;
  }

  public async getCaseHistory(
    context: ApplicationContext,
    caseId: string,
  ): Promise<CaseAssignmentHistory[]> {
    return this.gateway.getCaseAssignmentHistory(context, caseId);
  }
}
