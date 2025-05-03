import { CaseHistory } from '../../../../common/src/cams/history';
import { ApplicationContext } from '../../adapters/types/basic';
import Factory from '../../factory';

export class CaseHistoryUseCase {
  public async getCaseHistory(context: ApplicationContext): Promise<CaseHistory[]> {
    const caseId = context.request.params.id;
    const casesRepo = Factory.getCasesRepository(context);
    const caseHistory = casesRepo.getCaseHistory(caseId);
    return caseHistory;
  }
}
