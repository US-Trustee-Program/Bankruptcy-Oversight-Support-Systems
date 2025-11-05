import Factory from '../../factory';
import { ApplicationContext } from '../application.types';
import { CaseHistory } from '../../../../common/src/cams/history';

export class CaseHistoryUseCase {
  public async getCaseHistory(context: ApplicationContext): Promise<CaseHistory[]> {
    const caseId = context.request.params.id;
    const casesRepo = Factory.getCasesRepository(context);
    const caseHistory = casesRepo.getCaseHistory(caseId);
    return caseHistory;
  }
}
