import { ApplicationContext } from '../../adapters/types/basic';
import { CaseHistoryUseCase } from '../../use-cases/case-history/case-history';
import { isCamsError } from '../../common-errors/cams-error';
import { UnknownError } from '../../common-errors/unknown-error';
import { CamsResponse } from '../controller-types';
import { CaseHistory } from '../../../../../common/src/cams/history';

const MODULE_NAME = 'CASE-HISTORY-CONTROLLER';

type GetCaseHistoryRequest = {
  caseId: string;
};

type GetCaseHistoryResponse = CamsResponse<Array<CaseHistory>>;

export class CaseHistoryController {
  private readonly useCase: CaseHistoryUseCase;

  constructor(applicationContext: ApplicationContext) {
    this.useCase = new CaseHistoryUseCase(applicationContext);
  }

  public async getCaseHistory(
    context: ApplicationContext,
    request: GetCaseHistoryRequest,
  ): Promise<GetCaseHistoryResponse> {
    try {
      const caseHistory = await this.useCase.getCaseHistory(context, request.caseId);
      return {
        success: true,
        body: caseHistory,
      };
    } catch (originalError) {
      throw isCamsError(originalError)
        ? originalError
        : new UnknownError(MODULE_NAME, { originalError });
    }
  }
}
