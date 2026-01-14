import factory from '../../factory';
import { ApplicationContext } from '../../adapters/types/basic';
import { CaseHistory } from '@common/cams/history';

export class CaseHistoryUseCase {
  public async getCaseHistory(context: ApplicationContext): Promise<CaseHistory[]> {
    const caseId = context.request.params.id;
    const casesRepo = factory.getCasesRepository(context);
    const caseHistory = casesRepo.getCaseHistory(caseId);
    return caseHistory;
  }
}
