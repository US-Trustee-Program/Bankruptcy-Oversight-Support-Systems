import { getCasesRepository } from '../../factory';
import { ApplicationContext } from '../../adapters/types/basic';
import { CaseHistory } from '../../adapters/types/case.history';
import { CasesRepository } from '../gateways.types';

export class CaseHistoryUseCase {
  private casesRepository: CasesRepository;

  constructor(applicationContext: ApplicationContext) {
    this.casesRepository = getCasesRepository(applicationContext);
  }

  public async getCaseHistory(context: ApplicationContext, caseId: string): Promise<CaseHistory[]> {
    return this.casesRepository.getCaseHistory(context, caseId);
  }
}
