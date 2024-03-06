import { getCasesRepository } from '../../factory';
import { ApplicationContext } from '../../adapters/types/basic';
import { CasesRepository } from '../gateways.types';
import { CaseHistory } from '../../../../../common/src/cams/history';

export class CaseHistoryUseCase {
  private casesRepository: CasesRepository;

  constructor(applicationContext: ApplicationContext) {
    this.casesRepository = getCasesRepository(applicationContext);
  }

  public async getCaseHistory(context: ApplicationContext, caseId: string): Promise<CaseHistory[]> {
    return this.casesRepository.getCaseHistory(context, caseId);
  }
}
